"use strict";

let SimpleOperations = artifacts.require("./SimpleOperations.sol");

contract("SimpleOperations", accounts => {
  it("should initialize the contract with the parity client", async () => {
    let operations = await SimpleOperations.deployed();
    let owner = await operations.client("parity");

    assert.equal(owner, accounts[0]);

    // the creator of the operations contract should be set as the owner of the parity client
    let client = await operations.clientOwner(accounts[0]);
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

  it("should allow the owner of a client to transfer ownership", async () => {
    let operations = await SimpleOperations.new();
    let watcher = operations.ClientOwnerChanged();

    // only the owner of the client can transfer ownership
    try {
      await operations.setClientOwner(accounts[2], { from: accounts[1] });
    } catch(error) {
      assert(error.message.includes("revert"));
    }

    let owner = await operations.client("parity");
    assert.equal(owner, accounts[0]);

    // we successfully transfer ownership of the parity client
    await operations.setClientOwner(accounts[1]);

    // the `client` and `clientOwner` should point to the new owner
    let new_owner = await operations.client("parity");
    assert.equal(new_owner, accounts[1]);

    let client = await operations.clientOwner(accounts[1]);
    assert.equal(web3.toUtf8(client), "parity");

    // the old owner should no longer exist in `clientOwner`
    let old_client = await operations.clientOwner(accounts[0]);
    assert.equal(old_client.valueOf(), 0);

    // it should emit a `ClientOwnerChanged` event
    let events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(web3.toUtf8(events[0].args.client), "parity");
    assert.equal(events[0].args.old, accounts[0]);
    assert.equal(events[0].args.now, accounts[1]);
  });
});
