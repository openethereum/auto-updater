"use strict";

const SimpleOperations = artifacts.require("./SimpleOperations.sol");

module.exports = deployer => {
  deployer.deploy(SimpleOperations);
};
