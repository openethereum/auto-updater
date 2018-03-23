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

pragma solidity ^0.4.19;

import "./Operations.sol";


/// Specialise proxy wallet. Owner can send transactions unhindered. Delegates
/// can send only particular transactions to a named Operations contract.
contract OperationsProxy {
	address public owner;
	mapping(uint8 => address) public delegate;
	mapping(uint8 => address) public confirmer;
	mapping(uint8 => mapping(bytes32 => bytes)) public waiting;
	mapping(bytes32 => uint8) public trackOfPendingRelease;
	Operations public operations;

	event Sent(address indexed to, uint value, bytes data);
	event OwnerChanged(address indexed was, address indexed who);
	event DelegateChanged(address indexed was, address indexed who, uint8 indexed track);
	event ConfirmerChanged(address indexed was, address indexed who, uint8 indexed track);
	event AddReleaseRelayed(uint8 indexed track, bytes32 indexed release);
	event AddChecksumRelayed(bytes32 indexed release, bytes32 indexed _platform);
	event NewRequestWaiting(uint8 indexed track, bytes32 hash);
	event RequestConfirmed(uint8 indexed track, bytes32 hash);
	event RequestRejected(uint8 indexed track, bytes32 hash);

	function OperationsProxy(
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
		only_owner
	{
		relay();
	}

	function send(address _to, uint _value, bytes _data)
		public
		payable
		only_owner
	{
		// solium-disable-next-line security/no-call-value
		require(_to.call.value(_value)(_data));
		Sent(_to, _value, _data);
	}

	function setOwner(address _owner)
		public
		only_owner
	{
		OwnerChanged(owner, _owner);
		owner = _owner;
	}

	function setDelegate(address _delegate, uint8 _track)
		public
		only_owner
	{
		DelegateChanged(delegate[_track], _delegate, _track);
		delegate[_track] = _delegate;
	}

	function setConfirmer(address _confirmer, uint8 _track)
		public
		only_owner
	{
		ConfirmerChanged(confirmer[_track], _confirmer, _track);
		confirmer[_track] = _confirmer;
	}

	function addRelease(
		bytes32 _release,
		uint32 _forkBlock,
		uint8 _track,
		uint24 _semver,
		bool _critical
	)
		public
	{
		if (relayOrConfirm(_track))
			AddReleaseRelayed(_track, _release);
		else
			trackOfPendingRelease[_release] = _track;
	}

	function addChecksum(bytes32 _release, bytes32 _platform, bytes32 _checksum)
		public
	{
		var track = trackOfPendingRelease[_release];
		if (track == 0)
			track = operations.track(operations.clientOwner(this), _release);
		if (relayOrConfirm(track))
			AddChecksumRelayed(_release, _platform);
	}

	function confirm(uint8 _track, bytes32 _hash)
		public
		payable
		only_confirmer_of_track(_track)
	{
		// solium-disable-next-line security/no-call-value
		require(address(operations).call.value(msg.value)(waiting[_track][_hash]));
		delete waiting[_track][_hash];
		RequestConfirmed(_track, _hash);
	}

	function reject(uint8 _track, bytes32 _hash)
		public
		only_confirmer_of_track(_track)
	{
		delete waiting[_track][_hash];
		RequestRejected(_track, _hash);
	}

	function cleanupRelease(bytes32 _release)
		public
		only_confirmer_of_track(trackOfPendingRelease[_release])
	{
		delete trackOfPendingRelease[_release];
	}

	function kill() public only_owner {
		selfdestruct(msg.sender);
	}

	function relayOrConfirm(uint8 _track)
		internal
		only_delegate_of_track(_track)
		returns (bool)
	{
		if (confirmer[_track] != 0) {
			var h = keccak256(msg.data);
			waiting[_track][h] = msg.data;
			NewRequestWaiting(_track, h);
			return false;
		} else {
			relay();
			return true;
		}
	}

	function relay()
		internal
	{
		// solium-disable-next-line security/no-call-value
		require(address(operations).call.value(msg.value)(msg.data));
	}

	modifier only_owner {
		require(msg.sender == owner);
		_;
	}

	modifier only_delegate_of_track(uint8 track) {
		require(delegate[track] == msg.sender);
		_;
	}

	modifier only_confirmer_of_track(uint8 track) {
		require(confirmer[track] == msg.sender);
		_;
	}
}
