"use strict";

const { step } = require("mocha-steps");

const SimpleOperations = artifacts.require("./SimpleOperations.sol");

contract("SimpleOperations", accounts => {
  const assertThrowsAsync = async (fn, matcher) => {
    let f = () => {};
    try {
      await fn();
    } catch(e) {
      f = () => { throw e; };
    } finally {
      assert.throws(f, matcher);
    }
  };

  it("should initialize the contract with the parity client", async () => {
    const operations = await SimpleOperations.deployed();
    const owner = await operations.client("parity");

    assert.equal(owner, accounts[0]);

    // the creator of the operations contract should be set as the owner of the parity client
    const client = await operations.clientOwner(accounts[0]);
    assert.equal(web3.toUtf8(client), "parity");
  });

  it("should emit a `Received` event on fallback", async () => {
    const operations = await SimpleOperations.deployed();
    const watcher = operations.Received();

    await operations.sendTransaction({
      from: accounts[1],
      value: 3,
      data: web3.fromUtf8("hello"),
    });

    const events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(events[0].args.from, accounts[1]);
    assert.equal(events[0].args.value.valueOf(), 3);
    assert.equal(web3.toUtf8(events[0].args.data), "hello");
  });

  it("should allow the owner of a client to transfer ownership", async () => {
    const operations = await SimpleOperations.new();
    const watcher = operations.ClientOwnerChanged();

    // only the owner of the client can transfer ownership
    await assertThrowsAsync(
      async() => await operations.setClientOwner(accounts[2], { from: accounts[1] }),
      "revert",
    );

    const owner = await operations.client("parity");
    assert.equal(owner, accounts[0]);

    // we successfully transfer ownership of the parity client
    await operations.setClientOwner(accounts[1]);

    // the `client` and `clientOwner` should point to the new owner
    const new_owner = await operations.client("parity");
    assert.equal(new_owner, accounts[1]);

    const client = await operations.clientOwner(accounts[1]);
    assert.equal(web3.toUtf8(client), "parity");

    // the old owner should no longer exist in `clientOwner`
    const old_client = await operations.clientOwner(accounts[0]);
    assert.equal(old_client.valueOf(), 0);

    // it should emit a `ClientOwnerChanged` event
    const events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(web3.toUtf8(events[0].args.client), "parity");
    assert.equal(events[0].args.old, accounts[0]);
    assert.equal(events[0].args.now, accounts[1]);
  });

  step("should allow the owner of a client to add a release", async () => {
    const operations = await SimpleOperations.deployed();
    const watcher = operations.ReleaseAdded();

    const release = "0x1234560000000000000000000000000000000000000000000000000000000000";
    const forkBlock = "100";
    const track = "1";
    const semver = "65536";
    const critical = false;

    // only the owner of the client can add a release
    await assertThrowsAsync(
      async () => {
        await operations.addRelease(
          release,
          forkBlock,
          track,
          semver,
          critical,
          { from: accounts[1] },
        );
      },
      "revert",
    );

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

    // it should be set as the latest release for its track
    new_release = await operations.latestInTrack("parity", track);
    assert.equal(new_release, release);
    assert(await operations.isLatest("parity", release));

    // we can get the track for this release
    const new_track = await operations.track("parity", release);
    assert.equal(new_track, track);

    // it should emit a `ReleaseAdded` event
    const events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(web3.toUtf8(events[0].args.client), "parity");
    assert.equal(events[0].args.forkBlock, forkBlock);
    assert.equal(events[0].args.release, release);
    assert.equal(events[0].args.track, track);
    assert.equal(events[0].args.semver, semver);
    assert.equal(events[0].args.critical, critical);
  });

  step("should allow the owner of a client to add a checksum", async () => {
    const operations = await SimpleOperations.deployed();
    const watcher = operations.ChecksumAdded();

    const release = "0x1234560000000000000000000000000000000000000000000000000000000000";
    const platform = "0x1337000000000000000000000000000000000000000000000000000000000000";
    const checksum = "0x1111110000000000000000000000000000000000000000000000000000000000";

    // only the owner of the client can add a checksum
    await assertThrowsAsync(
      async() => {
        await operations.addChecksum(
          release,
          platform,
          checksum,
          { from: accounts[1] },
        );
      },
      "revert",
    );

    let new_checksum = await operations.checksum("parity", release, platform);
    assert.equal(new_checksum, 0);

    // we successfully add a checksum for a release
    await operations.addChecksum(release, platform, checksum);

    // the new checksum should be returned by the getter
    new_checksum = await operations.checksum("parity", release, platform);
    assert.equal(new_checksum, checksum);

    // the checksum should map to the release and platform
    const [new_release, new_platform] = await operations.build("parity", checksum);
    assert.equal(new_release, release);
    assert.equal(new_platform, platform);

    // it should emit a `ChecksumAdded` event
    const events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(web3.toUtf8(events[0].args.client), "parity");
    assert.equal(events[0].args.release, release);
    assert.equal(events[0].args.platform, platform);
    assert.equal(events[0].args.checksum, checksum);
  });

  step("should allow the owner of a client to add multiple checksums for the release", async () => {
    const operations = await SimpleOperations.deployed();
    const watcher = operations.ChecksumAdded();

    const release = "0x1234560000000000000000000000000000000000000000000000000000000000";
    const platforms = [
      "0x1000000000000000000000000000000000000000000000000000000000000000",
      "0x2000000000000000000000000000000000000000000000000000000000000000",
      "0x3000000000000000000000000000000000000000000000000000000000000000",
    ];
    const checksums = [
      "0x1111110000000000000000000000000000000000000000000000000000000000",
      "0x2222220000000000000000000000000000000000000000000000000000000000",
      "0x3333330000000000000000000000000000000000000000000000000000000000",
    ];

    const events = [];

    // we successfully add multiple checksums for a release for different platforms
    for (let i = 0; i < platforms.length; i++) {
      await operations.addChecksum(release, platforms[i], checksums[i]);
      events.push(...await watcher.get());
    }

    for (let i = 0; i < platforms.length; i++) {
      // the new checksum should be returned by the getter
      assert.equal(await operations.checksum("parity", release, platforms[i]), checksums[i]);

      // the checksum should map to the release and platform
      const [new_release, new_platform] = await operations.build("parity", checksums[i]);
      assert.equal(new_release, release);
      assert.equal(new_platform, platforms[i]);
    }

    // it should have emitted a `ChecksumAdded` event for each checksum added
    assert.equal(events.length, platforms.length);

    for (let i = 0; i < platforms.length; i++) {
      assert.equal(web3.toUtf8(events[i].args.client), "parity");
      assert.equal(events[i].args.release, release);
      assert.equal(events[i].args.platform, platforms[i]);
      assert.equal(events[i].args.checksum, checksums[i]);
    }
  });

  step("should allow the owner of the contract to add a client", async () => {
    const operations = await SimpleOperations.deployed();
    const watcher = operations.ClientAdded();

    // only the owner of the contract can add a new client
    await assertThrowsAsync(
      async () => {
        await operations.addClient(
          "parity-light",
          accounts[2],
          { from: accounts[1] },
        );
      },
      "revert",
    );

    let owner = await operations.client("parity-light");
    assert.equal(owner, 0);

    // we successfully add a new client
    await operations.addClient("parity-light", accounts[2]);

    owner = await operations.client("parity-light");

    assert.equal(owner, accounts[2]);

    // `accounts[2]` should be set as the owner of the parity-light client
    const client = await operations.clientOwner(accounts[2]);
    assert.equal(web3.toUtf8(client), "parity-light");

    // it should emit a `ClientAdded` event
    const events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(web3.toUtf8(events[0].args.client), "parity-light");
    assert.equal(events[0].args.owner, owner);
  });

  step("should allow the owner of the contract to reset the client owner", async () => {
    const operations = await SimpleOperations.deployed();
    const watcher = operations.ClientOwnerChanged();

    // only the owner of the contract can reset the client owner
    await assertThrowsAsync(
      async () => {
        await operations.resetClientOwner(
          "parity-light",
          accounts[0],
          { from: accounts[1] },
        );
      },
      "revert",
    );

    const owner = await operations.client("parity-light");
    assert.equal(owner, accounts[2]);

    // we successfully reset ownership of the parity-light client
    await operations.resetClientOwner("parity-light", accounts[1]);

    // the `client` and `clientOwner` should point to the new owner
    const new_owner = await operations.client("parity-light");
    assert.equal(new_owner, accounts[1]);

    const client = await operations.clientOwner(accounts[1]);
    assert.equal(web3.toUtf8(client), "parity-light");

    // the old owner should no longer exist in `clientOwner`
    const old_client = await operations.clientOwner(accounts[2]);
    assert.equal(old_client.valueOf(), 0);

    // it should emit a `ClientOwnerChanged` event
    const events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(web3.toUtf8(events[0].args.client), "parity-light");
    assert.equal(events[0].args.old, accounts[2]);
    assert.equal(events[0].args.now, accounts[1]);
  });

  step("should allow the owner of the contract to remove a client", async () => {
    const operations = await SimpleOperations.deployed();
    const watcher = operations.ClientRemoved();

    // only the owner of the contract can remove a client
    await assertThrowsAsync(
      async () => {
        await operations.removeClient(
          "parity-light",
          { from: accounts[1] },
        );
      },
      "revert",
    );

    let owner = await operations.client("parity-light");
    assert.equal(owner, accounts[1]);

    // we successfully remove the client
    await operations.removeClient("parity-light");

    owner = await operations.client("parity-light");
    assert.equal(owner, 0);

    // `accounts[2]` should not be set as a client owner
    const client = await operations.clientOwner(accounts[2]);
    assert.equal(client, 0);

    // it should emit a `ClientRemoved` event
    const events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(web3.toUtf8(events[0].args.client), "parity-light");
  });

  it("should allow the owner of the contract to set the latest supported fork", async () => {
    const operations = await SimpleOperations.new();
    const watcher = operations.ForkRatified();

    // only the owner of the contract can set the latest fork
    await assertThrowsAsync(
      async () => await operations.setLatestFork(7, { from: accounts[1] }),
      "revert",
    );

    let latestFork = await operations.latestFork();
    assert.equal(latestFork, 0);

    // we successfully set the latest supported fork
    await operations.setLatestFork(7);

    // the `latestFork` should point to the newly set latest fork
    latestFork = await operations.latestFork();
    assert.equal(latestFork, 7);

    // it should emit a `ForkRatified` event
    const events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(events[0].args.forkNumber, 7);
  });

  it("should allow the owner of the contract to transfer ownership of the contract", async () => {
    const operations = await SimpleOperations.new();
    const watcher = operations.OwnerChanged();

    // only the owner of the contract can transfer ownership
    await assertThrowsAsync(
      async () => await operations.setOwner(accounts[1], { from: accounts[1] }),
      "revert",
    );

    let owner = await operations.grandOwner();
    assert.equal(owner, accounts[0]);

    // we successfully transfer ownership of the contract
    await operations.setOwner(accounts[1]);

    // the `grandOwner` should point to the new owner
    owner = await operations.grandOwner();
    assert.equal(owner, accounts[1]);

    // it should emit a `OwnerChanged` event
    const events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(events[0].args.old, accounts[0]);
    assert.equal(events[0].args.now, accounts[1]);

    // the old owner can no longer set a new owner
    await assertThrowsAsync(
      async () => await operations.setOwner(accounts[0], { from: accounts[0] }),
      "revert",
    );
  });

  it("shouldn't allow the owner of the contract to add duplicate clients", async () => {
    const operations = await SimpleOperations.new();
    const watcher = operations.ClientAdded();

    // we successfully add a new client
    await operations.addClient("parity-light", accounts[1]);
    let owner = await operations.client("parity-light");
    assert.equal(owner, accounts[1]);

    // we can't add a client that already exists
    await assertThrowsAsync(
      async () => await operations.addClient("parity-light", accounts[2]),
      "revert",
    );

    // client ownership should stay unchanged
    owner = await operations.client("parity-light");
    assert.equal(owner, accounts[1]);

    // No event should be emitted
    const events = await watcher.get();
    assert.equal(events.length, 0);
  });

  it("should prevent an owner from owning multiple clients", async () => {
    const operations = await SimpleOperations.new();

    await operations.addClient("parity-light", accounts[1]);
    let owner = await operations.client("parity-light");
    assert.equal(owner, accounts[1]);

    // we can't transfer ownership of the parity-light client to `accounts[0]` since it is already
    // an owner of the parity client
    await assertThrowsAsync(
      async () => await operations.setClientOwner(accounts[0], { from: accounts[1] }),
      "revert",
    );

    // we can't add a new client with `accounts[1]` as its owner since it is already an owner of the
    // parity-light client
    await assertThrowsAsync(
      async () => await operations.addClient("parity-lighter", accounts[1]),
      "revert",
    );

    // we can't reset the owner of the parity client to `accounts[1]` since it is already an owner
    // of the parity-light client
    await assertThrowsAsync(
      async () => await operations.resetClientOwner("parity", accounts[1]),
      "revert",
    );
  });
});
