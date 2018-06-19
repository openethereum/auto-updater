# auto-updater

[![Build Status][travis-image]][travis-url]
[![Solidity Coverage Status][coveralls-image]][coveralls-url]

[travis-image]: https://travis-ci.org/parity-contracts/auto-updater.svg?branch=master
[travis-url]: https://travis-ci.org/parity-contracts/auto-updater
[coveralls-image]: https://coveralls.io/repos/github/parity-contracts/auto-updater/badge.svg?branch=master
[coveralls-url]: https://coveralls.io/github/parity-contracts/auto-updater?branch=master

Operations contracts for parity's auto-updater.

## Description

The `Operations` contract interface provides a registry of release data for different clients. For
each registered client it is possible to fetch the latest release of a given release track
(e.g. stable, beta, nightly), and for each release there is a registry of binary checksums for each
available platform.

The interface is implemented by the `SimpleOperations` contract which has an owner. The owner of the
`SimpleOperations` contract can set client owners, which can themselves manage their own client
releases using:

- `addRelease(bytes32 _release, uint32 _forkBlock, uint8 _track, uint24 _semver, bool _critical)`
- `addChecksum(bytes32 _release, bytes32 _platform, bytes32 _checksum)`

Additionally, there's an `OperationsProxy` contract that is a specialised multisig proxy wallet for
the `Operations` contract. It splits the client management primitives into a two step process, where
a delegate account can propose releases (or checksums) which must then be approved by a confirmer
account. The delegates and confirmers are defined per track.

### Note

Due to the way data is stored in the `SimpleOperations` contract, the semantics of client removal
are a bit tricky. Whenever a client is removed by the contract owner, only ownership of the client
from the current client owner is removed, the existing release and build data is kept. The getters
in the contract are guarded against this behavior, and check that the client is currently not
removed (i.e. no owner) before accessing the data. **If a removed client is then re-added (with
`setClient`) all of the previous release and build information is available and returned by the
getters.**

## Getting started

This project uses the [Truffle](http://truffleframework.com/) framework. To install the required
dependencies run:

```
yarn install
```

To run the test suite:

```
yarn test
```
