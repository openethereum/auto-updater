"use strict";

let Operations = artifacts.require("./Operations.sol");

module.exports = deployer => {
  deployer.deploy(Operations);
};
