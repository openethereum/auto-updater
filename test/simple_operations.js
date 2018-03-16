"use strict";

let SimpleOperations = artifacts.require("./SimpleOperations.sol");

contract("SimpleOperations", accounts => {
  it("should initialize the contract with the parity client", async () => {
    let operations = await SimpleOperations.deployed();
    let owner = await operations.client.call("parity");

    assert.equal(owner, accounts[0]);

    let client = await operations.clientOwner.call(accounts[0]);
    assert.equal(web3.toUtf8(client), "parity");
  });
});
