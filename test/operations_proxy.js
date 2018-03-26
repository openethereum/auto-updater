"use strict";

const { step } = require("mocha-steps");
const { assertThrowsAsync } = require("./utils.js");

const SimpleOperations = artifacts.require("./SimpleOperations.sol");
const OperationsProxy = artifacts.require("./OperationsProxy.sol");

contract("OperationsProxy", accounts => {
  const deploy_operations_proxy = async (deployed_operations = true) => {
    const operations =
          deployed_operations?
          await SimpleOperations.deployed() :
          await SimpleOperations.new();

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
});
