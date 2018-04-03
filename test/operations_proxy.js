"use strict";

const abi = require("ethereumjs-abi");
const { assertThrowsAsync } = require("./utils.js");

const SimpleOperations = artifacts.require("./SimpleOperations.sol");
const OperationsProxy = artifacts.require("./OperationsProxy.sol");

contract("OperationsProxy", accounts => {
  const deploy_operations_proxy = async () => {
    const operations = await SimpleOperations.new();
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

    // transfer ownership of the parity client to the proxy contract
    await operations.setClientOwner(operations_proxy.address);

    return [operations, operations_proxy];
  };

  it("should initialize the contract with the given parameters", async () => {
    let [operations, operations_proxy] = await deploy_operations_proxy();
    assert.equal(accounts[0], await operations_proxy.owner());
    assert.equal(accounts[1], await operations_proxy.delegate(1));
    assert.equal(accounts[2], await operations_proxy.delegate(2));
    assert.equal(accounts[3], await operations_proxy.delegate(3));
    assert.equal(accounts[4], await operations_proxy.confirmer(1));
    assert.equal(accounts[5], await operations_proxy.confirmer(2));
    assert.equal(accounts[6], await operations_proxy.confirmer(3));
  });

  it("should relay calls to the `Operations` contract on fallback", async () => {
    let [operations, operations_proxy] = await deploy_operations_proxy();
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

    // it should revert on failed calls to the operations contract
    await assertThrowsAsync(
      () => operations_proxy.sendTransaction({
        from: accounts[0],
        data: "hello",
      }),
      "revert",
    );
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

  it("should relay addRelease and addChecksum requests after they are confirmed", async () => {
    let [operations, operations_proxy] = await deploy_operations_proxy();
    let watcher = operations_proxy.NewRequestWaiting();

    const release = "0x1234560000000000000000000000000000000000000000000000000000000000";
    const forkBlock = "100";
    const track = "1";
    const semver = "65536";
    const critical = false;
    const platform = "0x1337000000000000000000000000000000000000000000000000000000000000";
    const checksum = "0x1111110000000000000000000000000000000000000000000000000000000000";

    // only the track delegate (`accounts[1]`) can add a release
    await assertThrowsAsync(
      () => operations_proxy.addRelease(release, forkBlock, track, semver, critical),
      "revert",
    );

    // we successfully add a new release
    await operations_proxy.addRelease(
      release,
      forkBlock,
      track,
      semver,
      critical,
      { from: accounts[1] },
    );

    // it should emit a `NewRequestWaiting` event
    let events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(events[0].args.track, track);

    const add_release_hash = events[0].args.hash;

    // the pending release state variables should be updated
    assert.equal(
      await operations_proxy.pendingRelease(add_release_hash),
      release,
    );

    assert.equal(
      await operations_proxy.trackOfPendingRelease(release),
      track,
    );

    // only the track delegate (`accounts[1]`) can add a checksum
    await assertThrowsAsync(
      () => operations_proxy.addChecksum(release, platform, checksum),
      "revert",
    );

    // we successfully add a new checksum
    await operations_proxy.addChecksum(release, platform, checksum, { from: accounts[1] }),

    // it should emit a `NewRequestWaiting` event
    events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(events[0].args.track, track);

    const add_checksum_hash = events[0].args.hash;

    // only the track confirmer (`accounts[4]`) can confirm a request
    await assertThrowsAsync(
      () => operations_proxy.confirm(track, add_release_hash),
      "revert",
    );

    watcher = operations_proxy.RequestConfirmed();
    let operations_watcher = operations.ReleaseAdded();

    // we successfully confirm the add release request
    await operations_proxy.confirm(track, add_release_hash, { from: accounts[4] });

    // it should emit a `RequestConfirmed` event
    events = await watcher.get();
    assert.equal(events.length, 1);
    assert.equal(events[0].args.track, track);
    assert.equal(events[0].args.hash, add_release_hash);
    assert.equal(events[0].args.success, true);

    // the operations contract should emit a `ReleaseAdded` event
    events = await operations_watcher.get();
    assert.equal(events.length, 1);
    assert.equal(web3.toUtf8(events[0].args.client), "parity");
    assert.equal(events[0].args.forkBlock, forkBlock);
    assert.equal(events[0].args.release, release);
    assert.equal(events[0].args.track, track);
    assert.equal(events[0].args.semver, semver);
    assert.equal(events[0].args.critical, critical);

    // the pending release state variables should be cleared
    assert.equal(await operations_proxy.pendingRelease(add_release_hash), 0);
    assert.equal(await operations_proxy.trackOfPendingRelease(release), 0);

    watcher = operations_proxy.RequestConfirmed();
    operations_watcher = operations.ChecksumAdded();

    // we successfully confirm the add checksum request
    await operations_proxy.confirm(track, add_checksum_hash, { from: accounts[4] });

    // it should emit a `RequestConfirmed` event
    events = await watcher.get();
    assert.equal(events.length, 1);
    assert.equal(events[0].args.track, track);
    assert.equal(events[0].args.hash, add_checksum_hash);
    assert.equal(events[0].args.success, true);

    // the operations contract should emit a `ChecksumAdded` event
    events = await operations_watcher.get();
    assert.equal(events.length, 1);
    assert.equal(web3.toUtf8(events[0].args.client), "parity");
    assert.equal(events[0].args.release, release);
    assert.equal(events[0].args.platform, platform);
    assert.equal(events[0].args.checksum, checksum);

    // the waiting requests should be cleared
    assert.equal(await operations_proxy.waiting(track, add_release_hash), "0x");
    assert.equal(await operations_proxy.waiting(track, add_checksum_hash), "0x");
  });

  it("should clean up state after rejecting a request", async () => {
    let [operations, operations_proxy] = await deploy_operations_proxy();
    let watcher = operations_proxy.NewRequestWaiting();

    const release = "0x1234560000000000000000000000000000000000000000000000000000000000";
    const forkBlock = "100";
    const track = "1";
    const semver = "65536";
    const critical = false;

    // we successfully add a new release
    await operations_proxy.addRelease(
      release,
      forkBlock,
      track,
      semver,
      critical,
      { from: accounts[1] },
    );

    // it should emit a `NewRequestWaiting` event
    let events = await watcher.get();

    assert.equal(events.length, 1);
    assert.equal(events[0].args.track, track);

    const add_release_hash = events[0].args.hash;

    // only the track confirmer (`accounts[4]`) can reject a request
    await assertThrowsAsync(
      () => operations_proxy.reject(track, add_release_hash),
      "revert",
    );

    watcher = operations_proxy.RequestRejected();

    // we reject the add release request
    await operations_proxy.reject(track, add_release_hash, { from: accounts[4] });

    // it should emit a `RequestRejected` event
    events = await watcher.get();
    assert.equal(events.length, 1);
    assert.equal(events[0].args.track, track);
    assert.equal(events[0].args.hash, add_release_hash);

    // the pending release state variables should be cleared
    assert.equal(await operations_proxy.pendingRelease(add_release_hash), 0);
    assert.equal(await operations_proxy.trackOfPendingRelease(release), 0);

    // the waiting request should be cleared
    assert.equal(await operations_proxy.waiting(track, add_release_hash), "0x");
  });

  it("should validate addChecksum requests for already existing releases", async () => {
    let [operations, operations_proxy] = await deploy_operations_proxy();
    let watcher = operations_proxy.NewRequestWaiting();

    const release = "0x1234560000000000000000000000000000000000000000000000000000000000";
    const forkBlock = "100";
    const track = "1";
    const semver = "65536";
    const critical = false;
    const platform = "0x1337000000000000000000000000000000000000000000000000000000000000";
    const checksum = "0x1111110000000000000000000000000000000000000000000000000000000000";

    // add a new release
    await operations_proxy.addRelease(
      release,
      forkBlock,
      track,
      semver,
      critical,
      { from: accounts[1] },
    );
    let events = await watcher.get();
    const add_release_hash = events[0].args.hash;

    // confirm the add release request
    await operations_proxy.confirm(track, add_release_hash, { from: accounts[4] });

    // pending release state variables are now cleared, so the add checksum
    // request will have to fetch track data from the operations contract

    // add a new checksum
    await operations_proxy.addChecksum(release, platform, checksum, { from: accounts[1] }),

    // it should emit a `NewRequestWaiting` event
    events = await watcher.get();
    const add_checksum_hash = events[0].args.hash;

    watcher = operations_proxy.RequestConfirmed();
    let operations_watcher = operations.ChecksumAdded();

    // confirm the add checksum request
    await operations_proxy.confirm(track, add_checksum_hash, { from: accounts[4] });

    // it should emit a `RequestConfirmed` event
    events = await watcher.get();
    assert.equal(events.length, 1);
    assert.equal(events[0].args.track, track);
    assert.equal(events[0].args.hash, add_checksum_hash);
    assert.equal(events[0].args.success, true);

    // the operations contract should emit a `ChecksumAdded` event
    events = await operations_watcher.get();
    assert.equal(events.length, 1);
    assert.equal(web3.toUtf8(events[0].args.client), "parity");
    assert.equal(events[0].args.release, release);
    assert.equal(events[0].args.platform, platform);
    assert.equal(events[0].args.checksum, checksum);
  });

  it("should relay requests right away if no track confirmer is defined", async () => {
    let [operations, operations_proxy] = await deploy_operations_proxy();

    const release = "0x1234560000000000000000000000000000000000000000000000000000000000";
    const forkBlock = "100";
    const track = "1";
    const semver = "65536";
    const critical = false;
    const platform = "0x1337000000000000000000000000000000000000000000000000000000000000";
    const checksum = "0x1111110000000000000000000000000000000000000000000000000000000000";

    // remove confirmer for the track
    await operations_proxy.setConfirmer(0, track);

    let watcher = operations_proxy.RequestConfirmed();
    let operations_watcher = operations.ReleaseAdded();

    // we successfully add a new release
    await operations_proxy.addRelease(
      release,
      forkBlock,
      track,
      semver,
      critical,
      { from: accounts[1] },
    );

    // since there is no confirmer for the track it should be relayed right away
    // and it should emit a `RequestConfirmed` event
    let events = await watcher.get();
    assert.equal(events.length, 1);
    assert.equal(events[0].args.track, track);
    assert.equal(events[0].args.success, true);

    // the operations contract should emit a `ReleaseAdded` event
    events = await operations_watcher.get();
    assert.equal(events.length, 1);
    assert.equal(web3.toUtf8(events[0].args.client), "parity");
    assert.equal(events[0].args.forkBlock, forkBlock);
    assert.equal(events[0].args.release, release);
    assert.equal(events[0].args.track, track);
    assert.equal(events[0].args.semver, semver);
    assert.equal(events[0].args.critical, critical);

    watcher = operations_proxy.RequestConfirmed();
    operations_watcher = operations.ChecksumAdded();

    // we successfully add a new release
    await operations_proxy.addChecksum(release, platform, checksum, { from: accounts[1] });

    // since there is no confirmer for the track it should be relayed right away
    // and it should emit a `RequestConfirmed` event
    events = await watcher.get();
    assert.equal(events.length, 1);
    assert.equal(events[0].args.track, track);
    assert.equal(events[0].args.success, true);

    // the operations contract should emit a `ChecksumAdded` event
    events = await operations_watcher.get();
    assert.equal(events.length, 1);
    assert.equal(web3.toUtf8(events[0].args.client), "parity");
    assert.equal(events[0].args.release, release);
    assert.equal(events[0].args.platform, platform);
    assert.equal(events[0].args.checksum, checksum);
  });
});
