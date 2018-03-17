"use strict";

let { step } = require("mocha-steps");

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

  step("should allow the owner of a client to add a release", async () => {
    let operations = await SimpleOperations.deployed();
    let watcher = operations.ReleaseAdded();

    let release = "0x1234560000000000000000000000000000000000000000000000000000000000";
    let forkBlock = "100";
    let track = "1";
    let semver = "65536";
    let critical = false;

    // only the owner of the client can add a release
    try {
      await operations.addRelease(
        release,
        forkBlock,
        track,
        semver,
        critical,
        { from: accounts[1] },
      );
    } catch(error) {
      assert(error.message.includes("revert"));
    }

    let new_release = await operations.release("parity", release);
    assert.deepEqual(
      new_release.map(v => v.valueOf()),
      ["0", "0", "0", false],
    );

    // we successfully add a release of the parity client
    await operations.addRelease(release, forkBlock, track, semver, critical);

    // the new release should be returned by the getter
    new_release = await operations.release("parity", release);
    assert.deepEqual(
      new_release.map(v => v.valueOf()),
      [forkBlock, track, semver, critical],
    );

    // it should be set has the latest release for its track
    new_release = await operations.latestInTrack("parity", track);
    assert.equal(new_release, release);
    assert(await operations.isLatest("parity", release));

    // we can get the track for this release
    let new_track = await operations.track("parity", release);
    assert.equal(new_track, track);

    // it should emit a `ReleaseAdded` event
    let events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(web3.toUtf8(events[0].args.client), "parity");
    assert.equal(events[0].args.forkBlock, forkBlock);
    assert.equal(events[0].args.release, release);
    assert.equal(events[0].args.track, track);
    assert.equal(events[0].args.semver, semver);
    assert.equal(events[0].args.critical, critical);
  });

  step("should allow the owner of a client to add a checksum", async () => {
    let operations = await SimpleOperations.deployed();
    let watcher = operations.ChecksumAdded();

    let release = "0x1234560000000000000000000000000000000000000000000000000000000000";
    let platform = "0x1337000000000000000000000000000000000000000000000000000000000000";
    let checksum = "0x1111110000000000000000000000000000000000000000000000000000000000";

    // only the owner of the client can add a release
    try {
      await operations.addChecksum(
        release,
        platform,
        checksum,
        { from: accounts[1] },
      );
    } catch(error) {
      assert(error.message.includes("revert"));
    }

    let new_checksum = await operations.checksum("parity", release, platform);
    assert.equal(new_checksum, 0);

    // we successfully add a checksum for a release for
    await operations.addChecksum(release, platform, checksum);

    // the new checksum should be returned by the getter
    new_checksum = await operations.checksum("parity", release, platform);
    assert.equal(new_checksum, checksum);

    // the checksum should map to the release and platform
    let [new_release, new_platform] = await operations.build("parity", checksum);
    assert.equal(new_release, release);
    assert.equal(new_platform, platform);

    // it should emit a `ChecksumAdded` event
    let events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(web3.toUtf8(events[0].args.client), "parity");
    assert.equal(events[0].args.release, release);
    assert.equal(events[0].args.platform, platform);
    assert.equal(events[0].args.checksum, checksum);
  });

  step("should allow the owner of the contract to add a client", async () => {
    let operations = await SimpleOperations.deployed();
    let watcher = operations.ClientAdded();

    // only the owner of the contract can add a new client
    try {
      await operations.addClient(
        "parity-light",
        accounts[2],
        { from: accounts[1] },
      );
    } catch(error) {
      assert(error.message.includes("revert"));
    }

    let owner = await operations.client("parity-light");
    assert.equal(owner, 0);

    // we successfully add a new client
    await operations.addClient("parity-light", accounts[2]);

    owner = await operations.client("parity-light");

    assert.equal(owner, accounts[2]);

    // the creator of the operations contract should be set as the owner of the parity client
    let client = await operations.clientOwner(accounts[2]);
    assert.equal(web3.toUtf8(client), "parity-light");

    // it should emit a `ClientAdded` event
    let events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(web3.toUtf8(events[0].args.client), "parity-light");
    assert.equal(events[0].args.owner, owner);
  });

  step("should allow the owner of the contract to reset the client owner", async () => {
    let operations = await SimpleOperations.deployed();
    let watcher = operations.ClientOwnerChanged();

    // only the owner of the contract can reset the client owner
    try {
      await operations.resetClientOwner(
        "parity-light",
        accounts[0],
        { from: accounts[1] },
      );
    } catch(error) {
      assert(error.message.includes("revert"));
    }

    let owner = await operations.client("parity-light");
    assert.equal(owner, accounts[2]);

    // we successfully reset ownership of the parity-light client
    await operations.resetClientOwner("parity-light", accounts[1]);

    // the `client` and `clientOwner` should point to the new owner
    let new_owner = await operations.client("parity-light");
    assert.equal(new_owner, accounts[1]);

    let client = await operations.clientOwner(accounts[1]);
    assert.equal(web3.toUtf8(client), "parity-light");

    // the old owner should no longer exist in `clientOwner`
    let old_client = await operations.clientOwner(accounts[2]);
    assert.equal(old_client.valueOf(), 0);

    // it should emit a `ClientOwnerChanged` event
    let events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(web3.toUtf8(events[0].args.client), "parity-light");
    assert.equal(events[0].args.old, accounts[2]);
    assert.equal(events[0].args.now, accounts[1]);
  });

  step("should allow the owner of the contract to remove a client", async () => {
    let operations = await SimpleOperations.deployed();
    let watcher = operations.ClientRemoved();

    // only the owner of the contract can remove a client
    try {
      await operations.removeClient(
        "parity-light",
        { from: accounts[1] },
      );
    } catch(error) {
      assert(error.message.includes("revert"));
    }

    let owner = await operations.client("parity-light");
    assert.equal(owner, accounts[1]);

    // we successfully remove the client
    await operations.removeClient("parity-light");

    owner = await operations.client("parity-light");
    assert.equal(owner, 0);

    // the creator of the operations contract should be set as the owner of the parity client
    let client = await operations.clientOwner(accounts[2]);
    assert.equal(client, 0);

    // it should emit a `ClientRemoved` event
    let events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(web3.toUtf8(events[0].args.client), "parity-light");
  });
});
