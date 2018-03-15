"use strict";

let SimpleOperations = artifacts.require("./SimpleOperations.sol");

module.exports = deployer => {
  deployer.deploy(SimpleOperations);
};
