// The operations contract interface.
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

interface Operations {
	function proposeFork(uint32 _number, bytes32 _name, bool _hard, bytes32 _spec) public;
	function acceptFork() public;
	function rejectFork() public;
	function setClientOwner(address _newOwner) public;
	function addRelease(bytes32 _release, uint32 _forkBlock, uint8 _track, uint24 _semver, bool _critical) public;
	function addChecksum(bytes32 _release, bytes32 _platform, bytes32 _checksum) public;

	function isLatest(bytes32 _client, bytes32 _release) public view returns (bool);
	function track(bytes32 _client, bytes32 _release) public view returns (uint8);
	function latestInTrack(bytes32 _client, uint8 _track) public view returns (bytes32);
	function build(bytes32 _client, bytes32 _checksum) public view returns (bytes32 o_release, bytes32 o_platform);
	function release(bytes32 _client, bytes32 _release) public view returns (uint32 o_forkBlock, uint8 o_track, uint24 o_semver, bool o_critical);
	function checksum(bytes32 _client, bytes32 _release, bytes32 _platform) public view returns (bytes32);

	function clientOwner(address _owner) public view returns (bytes32);
}
