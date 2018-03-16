"use strict";

let SimpleOperations = artifacts.require("./SimpleOperations.sol");

contract("SimpleOperations", accounts => {
  it("should initialize the contract with the parity client", async () => {
    let operations = await SimpleOperations.deployed();
    let owner = await operations.client.call("parity");

    assert.equal(owner, accounts[0]);

    // the creator of the operations contract should be set as the owner of the parity client
    let client = await operations.clientOwner.call(accounts[0]);
    assert.equal(web3.toUtf8(client), "parity");
  });

  it("should emit a `Received` event on fallback", async () => {
    let operations = await SimpleOperations.deployed();
    let watcher = operations.Received();

    await operations.sendTransaction({
      from: accounts[1],
      value: 3,
      data: web3.fromUtf8("hello"),
    });

    let events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(events[0].args.from, accounts[1]);
    assert.equal(events[0].args.value.valueOf(), 3);
    assert.equal(web3.toUtf8(events[0].args.data), "hello");
  });
});
