// The operations contract.
//
// Copyright 2016 Gavin Wood, Parity Technologies Ltd.
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

	address public grandOwner = msg.sender;

	event Received(address indexed from, uint value, bytes data);
	event ReleaseAdded(bytes32 indexed client, uint32 indexed forkBlock, bytes32 release, uint8 track, uint24 semver, bool indexed critical);
	event ChecksumAdded(bytes32 indexed client, bytes32 indexed release, bytes32 indexed platform, bytes32 checksum);
	event ClientAdded(bytes32 indexed client, address owner);
	event ClientRemoved(bytes32 indexed client);
	event ClientOwnerChanged(bytes32 indexed client, address indexed old, address indexed now);
	event OwnerChanged(address old, address now);

	function SimpleOperations() public {
		client["parity"] = Client(msg.sender);
		clientOwner[msg.sender] = "parity";
	}

	function() public payable { Received(msg.sender, msg.value, msg.data); }

	// Functions for client owners

	function setClientOwner(address _newOwner) public only_client_owner {
		var newClient = clientOwner[msg.sender];
		clientOwner[msg.sender] = bytes32(0);
		clientOwner[_newOwner] = newClient;
		client[newClient].owner = _newOwner;
		ClientOwnerChanged(newClient, msg.sender, _newOwner);
	}

	function addRelease(bytes32 _release, uint32 _forkBlock, uint8 _track, uint24 _semver, bool _critical) public only_client_owner {
		var newClient = clientOwner[msg.sender];
		client[newClient].release[_release] = Release(_forkBlock, _track, _semver, _critical);
		client[newClient].current[_track] = _release;
		ReleaseAdded(newClient, _forkBlock, _release, _track, _semver, _critical);
	}

	function addChecksum(bytes32 _release, bytes32 _platform, bytes32 _checksum) public only_client_owner {
		var newClient = clientOwner[msg.sender];
		client[newClient].build[_checksum] = Build(_release, _platform);
		client[newClient].release[_release].checksum[_platform] = _checksum;
		ChecksumAdded(newClient, _release, _platform, _checksum);
	}

	// Admin functions

	function addClient(bytes32 _client, address _owner) public only_owner {
		client[_client].owner = _owner;
		clientOwner[_owner] = _client;
		ClientAdded(_client, _owner);
	}

	function removeClient(bytes32 _client) public only_owner {
		resetClientOwner(_client, 0);
		delete client[_client];
		ClientRemoved(_client);
	}

	function resetClientOwner(bytes32 _client, address _newOwner) public only_owner {
		var old = client[_client].owner;
		ClientOwnerChanged(_client, old, _newOwner);
		clientOwner[old] = bytes32(0);
		clientOwner[_newOwner] = _client;
		client[_client].owner = _newOwner;
	}

	function setOwner(address _newOwner) public only_owner {
		OwnerChanged(grandOwner, _newOwner);
		grandOwner = _newOwner;
	}

	// Getters

	function isLatest(bytes32 _client, bytes32 _release) public view returns (bool) {
		return latestInTrack(_client, track(_client, _release)) == _release;
	}

	function track(bytes32 _client, bytes32 _release) public view returns (uint8) {
		return client[_client].release[_release].track;
	}

	function latestInTrack(bytes32 _client, uint8 _track) public view returns (bytes32) {
		return client[_client].current[_track];
	}

	function build(bytes32 _client, bytes32 _checksum) public view returns (bytes32 o_release, bytes32 o_platform) {
		var b = client[_client].build[_checksum];
		o_release = b.release;
		o_platform = b.platform;
	}

	function release(bytes32 _client, bytes32 _release) public view returns (uint32 o_forkBlock, uint8 o_track, uint24 o_semver, bool o_critical) {
		var b = client[_client].release[_release];
		o_forkBlock = b.forkBlock;
		o_track = b.track;
		o_semver = b.semver;
		o_critical = b.critical;
	}

	function checksum(bytes32 _client, bytes32 _release, bytes32 _platform) public view returns (bytes32) {
		return client[_client].release[_release].checksum[_platform];
	}

	function clientOwner(address _owner) public view returns (bytes32) {
		return clientOwner[_owner];
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
}
