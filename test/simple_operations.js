"use strict";

const { step } = require("mocha-steps");
const { assertThrowsAsync } = require("./utils.js");

const SimpleOperations = artifacts.require("./SimpleOperations.sol");

contract("SimpleOperations", accounts => {
  it("should initialize the contract with the parity client", async () => {
    const operations = await SimpleOperations.deployed();
    const owner = await operations.client("parity");

    assert.equal(owner, accounts[0]);

    // the creator of the operations contract should be set as the owner of the parity client
    const client = await operations.clientOwner(accounts[0]);
    assert.equal(web3.toUtf8(client), "parity");
  });

  it("should allow the owner of a client to transfer ownership", async () => {
    const operations = await SimpleOperations.new();

    // only the owner of the client can transfer ownership
    await assertThrowsAsync(
      () => operations.setClientOwner(accounts[2], { from: accounts[1] }),
      "revert",
    );

    const owner = await operations.client("parity");
    assert.equal(owner, accounts[0]);

    // we can't transfer ownership to the 0 address
    await assertThrowsAsync(
      () => operations.setClientOwner(0),
      "revert",
    );

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
      () => operations.addRelease(
        release,
        forkBlock,
        track,
        semver,
        critical,
        { from: accounts[1] },
      ),
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
      () => operations.addChecksum(
        release,
        platform,
        checksum,
        { from: accounts[1] },
      ),
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

  it("should prevent the owner of a client from adding checksums for a non-existent release", async () => {
    const operations = await SimpleOperations.new();
    const watcher = operations.ChecksumAdded();

    const release = "0x1234560000000000000000000000000000000000000000000000000000000000";
    const platform = "0x1337000000000000000000000000000000000000000000000000000000000000";
    const checksum = "0x1111110000000000000000000000000000000000000000000000000000000000";

    // we cannot add a checksum for a release that doesn't exist
    await assertThrowsAsync(
      () => operations.addChecksum(release, platform, checksum),
      "revert",
    );

    await operations.addRelease(release, 1, 1, 1, false);

    // after adding the release we successfully add a checksum
    await operations.addChecksum(release, platform, checksum);

    // the new checksum should be returned by the getter
    const new_checksum = await operations.checksum("parity", release, platform);
    assert.equal(new_checksum, checksum);
  });

  step("should allow the owner of the contract to add/set a client", async () => {
    const operations = await SimpleOperations.deployed();

    // only the owner of the contract can set a client
    await assertThrowsAsync(
      () => operations.setClient(
        "parity-light",
        accounts[2],
        { from: accounts[1] },
      ),
      "revert",
    );

    let owner = await operations.client("parity-light");
    assert.equal(owner, 0);

    // we can't set the owner of the client to be 0
    await assertThrowsAsync(
      () => operations.setClient("parity-light", 0),
      "revert",
    );

    // we successfully set a new client
    await operations.setClient("parity-light", accounts[2]);

    owner = await operations.client("parity-light");
    assert.equal(owner, accounts[2]);

    // `accounts[2]` should be set as the owner of the parity-light client
    let client = await operations.clientOwner(accounts[2]);
    assert.equal(web3.toUtf8(client), "parity-light");

    // we update the parity-light client owner
    await operations.setClient("parity-light", accounts[1]);

    owner = await operations.client("parity-light");
    assert.equal(owner, accounts[1]);

    // `accounts[1]` should be set as the owner of the parity-light client
    client = await operations.clientOwner(accounts[1]);
    assert.equal(web3.toUtf8(client), "parity-light");

    // `accounts[2]` should no longer exist in `clientOwner`
    const old_client = await operations.clientOwner(accounts[2]);
    assert.equal(old_client.valueOf(), 0);
  });

  step("should allow the owner of the contract to remove a client", async () => {
    const operations = await SimpleOperations.deployed();

    // only the owner of the contract can remove a client
    await assertThrowsAsync(
      () => operations.removeClient(
        "parity-light",
        { from: accounts[1] },
      ),
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
  });

  it("should allow the owner of the contract to set the latest supported fork", async () => {
    const operations = await SimpleOperations.new();
    const watcher = operations.ForkRatified();

    // only the owner of the contract can set the latest fork
    await assertThrowsAsync(
      () => operations.setLatestFork(7, { from: accounts[1] }),
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
      () => operations.setOwner(accounts[1], { from: accounts[1] }),
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
      () => operations.setOwner(accounts[0], { from: accounts[0] }),
      "revert",
    );
  });

  it("should prevent an owner from owning multiple clients", async () => {
    const operations = await SimpleOperations.new();

    await operations.setClient("parity-light", accounts[1]);
    let owner = await operations.client("parity-light");
    assert.equal(owner, accounts[1]);

    // we can't transfer ownership of the parity-light client to `accounts[0]` since it is already
    // an owner of the parity client
    await assertThrowsAsync(
      () => operations.setClientOwner(accounts[0], { from: accounts[1] }),
      "revert",
    );

    // we can't add a new client with `accounts[1]` as its owner since it is already an owner of the
    // parity-light client
    await assertThrowsAsync(
      () => operations.setClient("parity-lighter", accounts[1]),
      "revert",
    );
  });

  it("should prevent getting data from removed clients", async () => {
    const operations = await SimpleOperations.new();

    const client = "parity-light";
    const release = "0x1234560000000000000000000000000000000000000000000000000000000000";
    const forkBlock = "100";
    const track = "1";
    const semver = "65536";
    const critical = false;
    const platform = "0x1337000000000000000000000000000000000000000000000000000000000000";
    const checksum = "0x1111110000000000000000000000000000000000000000000000000000000000";

    // we set the ownership of the parity-light client to `accounts[1]`
    await operations.setClient(client, accounts[1]);

    // we add a release and checksum
    await operations.addRelease(
      release,
      forkBlock,
      track,
      semver,
      critical,
      { from: accounts[1] },
    );

    await operations.addChecksum(release, platform, checksum, { from: accounts[1] }),

    // we successfully remove the client
    await operations.removeClient(client);

    // `accounts[1]` should not be set as a client owner
    let owner = await operations.client(client);
    assert.equal(owner, 0);
    assert.equal(await operations.clientOwner(accounts[1]), 0);

    // the getters should not return existing information from the removed client
    assert.equal(await operations.isLatest(client, release), false);
    assert.equal(await operations.track(client, release), 0);
    assert.equal(await operations.latestInTrack(client, track), 0);
    assert.deepEqual(
      (await operations.build(client, checksum)).map(web3.toDecimal),
      [0, 0],
    );
    assert.deepEqual(
      (await operations.release(client, release)).map(web3.toDecimal),
      [0, 0, 0, 0],
    );
    assert.equal(await operations.checksum(client, release, platform), 0);

    // we re-add the client
    await operations.setClient("parity-light", accounts[1]);

    // `accounts[1]` is re-added as the client owner
    owner = await operations.client(client);
    assert.equal(owner, accounts[1]);
    assert.equal(web3.toUtf8(await operations.clientOwner(accounts[1])), client);

    // all of the previous release and build data should is available again
    assert.equal(await operations.isLatest(client, release), true);
    assert.equal(await operations.track(client, release), track);
    assert.equal(await operations.latestInTrack(client, track), release);
    assert.deepEqual(
      await operations.build(client, checksum),
      [release, platform],
    );
    assert.deepEqual(
      (await operations.release(client, release)).map(v => v.valueOf()),
      [forkBlock, track, semver, critical],
    );
    assert.equal(await operations.checksum(client, release, platform), checksum);
  });
});
