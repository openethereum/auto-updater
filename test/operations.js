"use strict";

let Operations = artifacts.require("./Operations.sol");

contract("Operations", accounts => {
  it("should initialize the contract with the parity client", async () => {
    let operations = await Operations.deployed();
    let [owner, required] = await operations.client.call("parity");

    assert.equal(owner, accounts[0]);
    assert(required);

    let client = await operations.clientOwner.call(accounts[0]);
    assert.equal(web3.toUtf8(client), "parity");
  });
});
