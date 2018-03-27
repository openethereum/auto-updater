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
});
