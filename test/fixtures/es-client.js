function indexCreate() {

}

function indexExists() {

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