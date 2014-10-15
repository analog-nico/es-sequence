'use strict';

var BPromise = require('bluebird');


function indexCreate() {

}

function indexExists() {
  return BPromise.resolve(true);
}

function indexPutMapping() {

}

function bulk() {

}


module.exports = {
  indices: {
    create: indexCreate,
    exists: indexExists,
    putMapping: indexPutMapping
  },
  bulk: bulk
};