'use strict';

var Promise = require('bluebird');


function indexCreate() {

}

function indexExists() {
  return Promise.resolve(true);
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