pragma solidity ^0.4.24;


contract Migrations {
	address public owner = msg.sender;
	uint public last_completed_migration;

	modifier restricted() {
		if (msg.sender == owner) {
			_;
		}
	}

	function setCompleted(uint completed) public restricted {
		last_completed_migration = completed;
	}

	function upgrade(address new_address) public restricted {
		Migrations upgraded = Migrations(new_address);
		upgraded.setCompleted(last_completed_migration);
	}
}
