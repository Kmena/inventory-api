const express = require('express');

const SMALL_PAYLOAD_LIMIT = '256kb';
const MEDIUM_PAYLOAD_LIMIT = '1mb';
const HIGH_PAYLOAD_LIMIT = '25mb';

function createPayloadParsers(limit) {
  return [
    express.json({ limit }),
    express.urlencoded({ extended: true, limit }),
  ];
}

const smallPayloadParsers = createPayloadParsers(SMALL_PAYLOAD_LIMIT);
const mediumPayloadParsers = createPayloadParsers(MEDIUM_PAYLOAD_LIMIT);
const highPayloadParsers = createPayloadParsers(HIGH_PAYLOAD_LIMIT);

module.exports = {
  SMALL_PAYLOAD_LIMIT,
  MEDIUM_PAYLOAD_LIMIT,
  HIGH_PAYLOAD_LIMIT,
  smallPayloadParsers,
  mediumPayloadParsers,
  highPayloadParsers,
};
