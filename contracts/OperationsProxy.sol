// The operations-proxy contract.
//
// Copyright 2016-2018 Gavin Wood, Parity Technologies (UK) Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

pragma solidity ^0.4.22;

import "./Operations.sol";


/// Specialise proxy wallet. Owner can send transactions unhindered. Delegates
/// can send only particular transactions to a named Operations contract.
contract OperationsProxy {
	event OwnerChanged(address indexed was, address indexed who);
	event DelegateChanged(address indexed was, address indexed who, uint8 indexed track);
	event ConfirmerChanged(address indexed was, address indexed who, uint8 indexed track);
	event NewRequestWaiting(uint8 indexed track, bytes32 hash);
	event RequestConfirmed(uint8 indexed track, bytes32 hash, bool success);
	event RequestRejected(uint8 indexed track, bytes32 hash);

	address public owner;
	mapping(uint8 => address) public delegate;
	mapping(uint8 => address) public confirmer;

	mapping(uint8 => mapping(bytes32 => bytes)) public waiting;
	mapping(bytes32 => bytes32) public pendingRelease;
	mapping(bytes32 => uint8) public trackOfPendingRelease;

	Operations public operations;

	modifier onlyOwner {
		require(msg.sender == owner);
		_;
	}

	modifier onlyDelegateOf(uint8 track) {
		require(delegate[track] == msg.sender);
		_;
	}

	modifier onlyConfirmerOf(uint8 track) {
		require(confirmer[track] == msg.sender);
		_;
	}

	constructor(
		address _owner,
		address _stable,
		address _beta,
		address _nightly,
		address _stableConfirmer,
		address _betaConfirmer,
		address _nightlyConfirmer,
		address _operations
	)
		public
	{
		owner = _owner;
		delegate[1] = _stable;
		delegate[2] = _beta;
		delegate[3] = _nightly;
		confirmer[1] = _stableConfirmer;
		confirmer[2] = _betaConfirmer;
		confirmer[3] = _nightlyConfirmer;
		operations = Operations(_operations);
	}

	function()
		public
		onlyOwner
	{
		// solium-disable-next-line security/no-low-level-calls
		require(address(operations).call(msg.data));
	}

	function setOwner(address _owner)
		external
		onlyOwner
	{
		emit OwnerChanged(owner, _owner);
		owner = _owner;
	}

	function setDelegate(address _delegate, uint8 _track)
		external
		onlyOwner
	{
		emit DelegateChanged(delegate[_track], _delegate, _track);
		delegate[_track] = _delegate;
	}

	function setConfirmer(address _confirmer, uint8 _track)
		external
		onlyOwner
	{
		emit ConfirmerChanged(confirmer[_track], _confirmer, _track);
		confirmer[_track] = _confirmer;
	}

	function addRelease(
		bytes32 _release,
		uint32 _forkBlock,
		uint8 _track,
		uint24 _semver,
		bool _critical
	)
		external
		onlyDelegateOf(_track)
	{
		bool relayed;
		bytes32 hash;
		(relayed, hash) = relayOrAddToWaiting(_track);

		if (!relayed) {
			pendingRelease[hash] = _release;
			trackOfPendingRelease[_release] = _track;
		}
	}

	function addChecksum(bytes32 _release, bytes32 _platform, bytes32 _checksum)
		external
	{
		uint8 track = trackOfPendingRelease[_release];
		if (track == 0) {
			track = operations.track(operations.clientOwner(this), _release);
		}

		require(delegate[track] == msg.sender);

		relayOrAddToWaiting(track);
	}

	function confirm(uint8 _track, bytes32 _hash)
		external
		onlyConfirmerOf(_track)
	{
		bytes memory request = waiting[_track][_hash];
		delete waiting[_track][_hash];
		cleanupRelease(_track, _hash);

		// solium-disable-next-line security/no-low-level-calls
		bool success = address(operations).call(request);
		emit RequestConfirmed(_track, _hash, success);
	}

	function reject(uint8 _track, bytes32 _hash)
		external
		onlyConfirmerOf(_track)
	{
		delete waiting[_track][_hash];
		emit RequestRejected(_track, _hash);

		cleanupRelease(_track, _hash);
	}

	// it is expected that this function is only called by the confirmer of the given track, the
	// function doesn't perform this validation.
	function cleanupRelease(uint8 _track, bytes32 _hash)
		internal
	{
		bytes32 release = pendingRelease[_hash];
		if (release != 0) {
			delete pendingRelease[_hash];
		}

		uint8 track = trackOfPendingRelease[release];
		if (track == _track) {
			delete trackOfPendingRelease[release];
		}
	}

	// it is expected that this function is only called by the delegate of the given track, the
	// function doesn't perform this validation.
	function relayOrAddToWaiting(uint8 _track)
		internal
		returns (bool o_relayed, bytes32 o_hash)
	{
		bytes32 hash = keccak256(msg.data);
		o_hash = hash;

		if (confirmer[_track] == 0) {
			// no confirmer for the track so can relay the transaction right away
			// solium-disable-next-line security/no-low-level-calls
			bool success = address(operations).call(msg.data);
			emit RequestConfirmed(_track, hash, success);

			o_relayed = true;
		} else {
			// add the request to wait until it is either confirmed or rejected
			waiting[_track][hash] = msg.data;
			emit NewRequestWaiting(_track, hash);

			o_relayed = false;
		}
	}
}
