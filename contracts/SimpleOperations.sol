// The operations contract.
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


contract SimpleOperations is Operations {
	struct Release {
		uint32 forkBlock;
		uint8 track;
		uint24 semver;
		bool critical;
		mapping (bytes32 => bytes32) checksum; // platform -> checksum
	}

	struct Build {
		bytes32 release;
		bytes32 platform;
	}

	struct Client {
		address owner;
		mapping (bytes32 => Release) release;
		mapping (uint8 => bytes32) current;
		mapping (bytes32 => Build) build; // checksum -> Build
	}

	mapping (bytes32 => Client) public client;
	mapping (address => bytes32) public clientOwner;

	uint32 public latestFork = 0;
	address public grandOwner = msg.sender;

	function SimpleOperations()
		public
	{
		client["parity"] = Client(msg.sender);
		clientOwner[msg.sender] = "parity";
	}

	// Functions for client owners

	function setClientOwner(address _newOwner)
		public
		only_client_owner
		not_client_owner(_newOwner)
	{
		var newClient = clientOwner[msg.sender];
		delete clientOwner[msg.sender];

		clientOwner[_newOwner] = newClient;
		client[newClient].owner = _newOwner;
	}

	/// Adds a release which is identified by `_release`. When a release is succesfully added, a
	/// `ReleaseAdded` event is emitted. The same release can be added multiple times (with
	/// different parameters), therefore the `ReleaseAdded` event can be emitted multiple times for
	/// the same release.
	function addRelease(
		bytes32 _release,
		uint32 _forkBlock,
		uint8 _track,
		uint24 _semver,
		bool _critical
	)
		public
		only_client_owner
	{
		var newClient = clientOwner[msg.sender];
		client[newClient].release[_release] = Release(
			_forkBlock,
			_track,
			_semver,
			_critical
		);
		client[newClient].current[_track] = _release;
		ReleaseAdded(
			newClient,
			_forkBlock,
			_release,
			_track,
			_semver,
			_critical
		);
	}

	/// Adds a `_checksum` for a `_release` binary targeting a given `_platform`. When a checksum is
	/// succesfully added, a `ChecksumAdded` event is emitted. The same checksum can be added
	/// multiple times (with different parameters), therefore the `ChecksumAdded` event can be
	/// emitted multiple times for the same checksum.
	function addChecksum(bytes32 _release, bytes32 _platform, bytes32 _checksum)
		public
		only_client_owner
	{
		var newClient = clientOwner[msg.sender];
		require(releaseExists(newClient, _release));
		client[newClient].build[_checksum] = Build(_release, _platform);
		client[newClient].release[_release].checksum[_platform] = _checksum;
		ChecksumAdded(
			newClient,
			_release,
			_platform,
			_checksum
		);
	}

	// Admin functions

	function setClient(bytes32 _client, address _owner)
		public
		only_owner
		not_client_owner(_owner)
	{
		var owner = client[_client].owner;
		delete clientOwner[owner];

		clientOwner[_owner] = _client;
		client[_client].owner = _owner;
	}

	function removeClient(bytes32 _client)
		public
		only_owner
	{
		var owner = client[_client].owner;
		delete clientOwner[owner];
		delete client[_client];
	}

	function setLatestFork(uint32 _forkNumber)
		public
		only_owner
	{
		ForkRatified(_forkNumber);
		latestFork = _forkNumber;
	}

	function setOwner(address _newOwner)
		public
		only_owner
	{
		OwnerChanged(grandOwner, _newOwner);
		grandOwner = _newOwner;
	}

	// Getters

	function isLatest(bytes32 _client, bytes32 _release)
		public
		view
		returns (bool)
	{
		return latestInTrack(_client, track(_client, _release)) == _release;
	}

	function track(bytes32 _client, bytes32 _release)
		public
		view
		returns (uint8)
	{
		return client[_client].release[_release].track;
	}

	function latestInTrack(bytes32 _client, uint8 _track)
		public
		view
		returns (bytes32)
	{
		return client[_client].current[_track];
	}

	function build(bytes32 _client, bytes32 _checksum)
		public
		view
		returns (bytes32 o_release, bytes32 o_platform)
	{
		var b = client[_client].build[_checksum];
		o_release = b.release;
		o_platform = b.platform;
	}

	function release(bytes32 _client, bytes32 _release)
		public
		view
		returns (
			uint32 o_forkBlock,
			uint8 o_track,
			uint24 o_semver,
			bool o_critical
		)
	{
		var b = client[_client].release[_release];
		o_forkBlock = b.forkBlock;
		o_track = b.track;
		o_semver = b.semver;
		o_critical = b.critical;
	}

	function checksum(bytes32 _client, bytes32 _release, bytes32 _platform)
		public
		view
		returns (bytes32)
	{
		return client[_client].release[_release].checksum[_platform];
	}

	function latestFork()
		public
		view
		returns (uint32)
	{
		return latestFork;
	}

	function clientOwner(address _owner)
		public
		view
		returns (bytes32)
	{
		return clientOwner[_owner];
	}

	// Internals

	function releaseExists(bytes32 _client, bytes32 _release)
		internal
		returns (bool)
	{
		var releas = client[_client].release[_release];
		return releas.forkBlock != 0 && releas.track != 0 && releas.semver != 0;
	}

	// Modifiers

	modifier only_owner {
		require(grandOwner == msg.sender);
		_;
	}

	modifier only_client_owner {
		var newClient = clientOwner[msg.sender];
		require(newClient != 0);
		_;
	}

	modifier not_client_owner(address owner) {
		require(clientOwner[owner] == 0);
		_;
	}
}
