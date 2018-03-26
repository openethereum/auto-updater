"use strict";

const abi = require("ethereumjs-abi");
const { step } = require("mocha-steps");
const { assertThrowsAsync } = require("./utils.js");

const SimpleOperations = artifacts.require("./SimpleOperations.sol");
const OperationsProxy = artifacts.require("./OperationsProxy.sol");

contract("OperationsProxy", accounts => {
  const deploy_operations_proxy = async (deploy_operations = false) => {
    const operations =
          deploy_operations?
          await SimpleOperations.new():
          await SimpleOperations.deployed();

    const operations_proxy =
          await OperationsProxy.new(
            accounts[0], // owner
            accounts[1], // delegate stable
            accounts[2], // delegate beta
            accounts[3], // delegate nightly
            accounts[4], // confirmer stable
            accounts[5], // confirmer beta
            accounts[6], // confirmer nightly
            operations.address,
          );

    return [operations, operations_proxy];
  };

  let operations;
  let operations_proxy;
  before(async () => {
    let [ops, ops_proxy] = await deploy_operations_proxy();
    operations = ops;
    operations_proxy = ops_proxy;
  });

  it("should initialize the contract with the given parameters", async () => {
    assert.equal(accounts[0], await operations_proxy.owner());
    assert.equal(accounts[1], await operations_proxy.delegate(1));
    assert.equal(accounts[2], await operations_proxy.delegate(2));
    assert.equal(accounts[3], await operations_proxy.delegate(3));
    assert.equal(accounts[4], await operations_proxy.confirmer(1));
    assert.equal(accounts[5], await operations_proxy.confirmer(2));
    assert.equal(accounts[6], await operations_proxy.confirmer(3));
  });

  it("should relay calls to the `Operations` contract on fallback", async () => {
    let [operations, operations_proxy] = await deploy_operations_proxy(true);
    const watcher = operations.ForkRatified();

    // set the operations proxy contract as the owner of the simple operations contract
    // to allow calling `setLatestFork`
    await operations.setOwner(operations_proxy.address);

    // encode call to Operations `setLatestFork`
    const encoded = abi.simpleEncode("setLatestFork(uint32)", 100).toString("hex");

    // only the owner of the operations proxy can use the fallback function
    await assertThrowsAsync(
      () => operations_proxy.sendTransaction({
        from: accounts[1],
        data: encoded,
      }),
      "revert",
    );

    // the unsupported call is relayed to the Operations contract
    let client = await operations_proxy.sendTransaction({
      from: accounts[0],
      data: encoded,
    });

    // if successful the operations contract should emit a `ForkRatified` event
    const events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(events[0].args.forkNumber.valueOf(), 100);
  });

  it("should allow the owner of the contract to transfer ownership of the contract", async () => {
    let [operations, operations_proxy] = await deploy_operations_proxy();
    const watcher = operations_proxy.OwnerChanged();

    // only the owner of the contract can transfer ownership
    await assertThrowsAsync(
      () => operations_proxy.setOwner(accounts[1], { from: accounts[1] }),
      "revert",
    );

    let owner = await operations_proxy.owner();
    assert.equal(owner, accounts[0]);

    // we successfully transfer ownership of the contract
    await operations_proxy.setOwner(accounts[1]);

    // the `owner` should point to the new owner
    owner = await operations_proxy.owner();
    assert.equal(owner, accounts[1]);

    // it should emit a `OwnerChanged` event
    const events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(events[0].args.was, accounts[0]);
    assert.equal(events[0].args.who, accounts[1]);

    // the old owner can no longer set a new owner
    await assertThrowsAsync(
      () => operations_proxy.setOwner(accounts[0], { from: accounts[0] }),
      "revert",
    );
  });

  it("should allow the owner of the contract to set track delegate", async () => {
    let [operations, operations_proxy] = await deploy_operations_proxy();
    const watcher = operations_proxy.DelegateChanged();

    // only the owner of the contract can set a track delegate
    await assertThrowsAsync(
      () => operations_proxy.setDelegate(accounts[9], 1, { from: accounts[1] }),
      "revert",
    );

    let delegate = await operations_proxy.delegate(1);
    assert.equal(delegate, accounts[1]);

    // we successfully change the delegate for the stable track
    await operations_proxy.setDelegate(accounts[9], 1);

    // the `delegate` for the stable track should point to the new delegate
    delegate = await operations_proxy.delegate(1);
    assert.equal(delegate, accounts[9]);

    // it should emit a `DelegateChanged` event
    const events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(events[0].args.was, accounts[1]);
    assert.equal(events[0].args.who, accounts[9]);
  });

  it("should allow the owner of the contract to set track confirmer", async () => {
    let [operations, operations_proxy] = await deploy_operations_proxy();
    const watcher = operations_proxy.ConfirmerChanged();

    // only the owner of the contract can set a track confirmer
    await assertThrowsAsync(
      () => operations_proxy.setConfirmer(accounts[9], 1, { from: accounts[1] }),
      "revert",
    );

    let confirmer = await operations_proxy.confirmer(1);
    assert.equal(confirmer, accounts[4]);

    // we successfully change the confirmer for the stable track
    await operations_proxy.setConfirmer(accounts[9], 1);

    // the `confirmer` for the stable track should point to the new confirmer
    confirmer = await operations_proxy.confirmer(1);
    assert.equal(confirmer, accounts[9]);

    // it should emit a `ConfirmerChanged` event
    const events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(events[0].args.was, accounts[4]);
    assert.equal(events[0].args.who, accounts[9]);
  });
});
