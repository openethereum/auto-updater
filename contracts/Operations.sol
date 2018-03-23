// The operations contract interface.
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


contract Operations {
	uint8 constant STABLE = 1;
	uint8 constant BETA = 2;
	uint8 constant NIGHTLY = 3;

	event Received(address indexed from, uint value, bytes data);
	event ReleaseAdded(
		bytes32 indexed client,
		uint32 indexed forkBlock,
		bytes32 release,
		uint8 track,
		uint24 semver,
		bool indexed critical
	);
	event ChecksumAdded(
		bytes32 indexed client,
		bytes32 indexed release,
		bytes32 indexed platform,
		bytes32 checksum
	);
	event ClientAdded(bytes32 indexed client, address owner);
	event ClientRemoved(bytes32 indexed client);
	event ClientOwnerChanged(bytes32 indexed client, address indexed old, address indexed now);
	event ForkRatified(uint32 indexed forkNumber);
	event OwnerChanged(address old, address now);

	function addRelease(
		bytes32 _release,
		uint32 _forkBlock,
		uint8 _track,
		uint24 _semver,
		bool _critical
	)
		public;

	function addChecksum(bytes32 _release, bytes32 _platform, bytes32 _checksum)
		public;

	function isLatest(bytes32 _client, bytes32 _release)
		public
		view
		returns (bool);

	function track(bytes32 _client, bytes32 _release)
		public
		view
		returns (uint8);

	function latestInTrack(bytes32 _client, uint8 _track)
		public
		view
		returns (bytes32);

	function build(bytes32 _client, bytes32 _checksum)
		public
		view
		returns (bytes32 o_release, bytes32 o_platform);

	function release(bytes32 _client, bytes32 _release)
		public
		view
		returns (
			uint32 o_forkBlock,
			uint8 o_track,
			uint24 o_semver,
			bool o_critical
		);

	function checksum(bytes32 _client, bytes32 _release, bytes32 _platform)
		public
		view
		returns (bytes32);

	function latestFork()
		public
		view
		returns (uint32);

	function clientOwner(address _owner)
		public
		view
		returns (bytes32);

	function setClientOwner(address _newOwner)
		public;
}
