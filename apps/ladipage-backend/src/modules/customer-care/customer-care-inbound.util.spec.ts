import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadGatewayException, NotFoundException } from '@nestjs/common';
import {
  isCustomerCareInboundAccepted,
  isLibreDeskConnectorAuthError,
  isLibreDeskInboxMissing,
  isPostgresUniqueViolation,
} from './customer-care-inbound.util.ts';

describe('customer-care-inbound.util', () => {
  describe('isPostgresUniqueViolation', () => {
    it('matches TypeORM QueryFailedError 23505 by constraint', () => {
      const error = {
        code: '23505',
        constraint: 'uq_cc_message_channel_external',
        message:
          'duplicate key value violates unique constraint "uq_cc_message_channel_external"',
      };
      assert.equal(
        isPostgresUniqueViolation(error, 'uq_cc_message_channel_external'),
        true,
      );
      assert.equal(
        isPostgresUniqueViolation(error, 'uq_cc_inbound_channel_event'),
        false,
      );
    });

    it('matches nested driverError from pg', () => {
      const error = {
        driverError: {
          code: '23505',
          constraint: 'uq_cc_inbound_channel_event',
        },
        message: 'duplicate key value violates unique constraint',
      };
      assert.equal(
        isPostgresUniqueViolation(error, 'uq_cc_inbound_channel_event'),
        true,
      );
    });

    it('ignores unrelated database errors', () => {
      assert.equal(
        isPostgresUniqueViolation({
          code: 'EMAXCONNSESSION',
          message: 'max clients',
        }),
        false,
      );
    });
  });

  describe('isLibreDeskConnectorAuthError', () => {
    it('matches the prod 502 from LibreDesk inbound', () => {
      assert.equal(
        isLibreDeskConnectorAuthError(
          new BadGatewayException('Invalid Zalo connector credentials'),
        ),
        true,
      );
      assert.equal(
        isLibreDeskConnectorAuthError(
          new BadGatewayException('Invalid Facebook connector credentials'),
        ),
        true,
      );
    });

    it('does not treat other LibreDesk failures as auth', () => {
      assert.equal(
        isLibreDeskConnectorAuthError(
          new BadGatewayException('LibreDesk inbound returned HTTP 500'),
        ),
        false,
      );
    });
  });

  describe('isLibreDeskInboxMissing', () => {
    it('matches missing inbox so ensure can POST a new one', () => {
      assert.equal(
        isLibreDeskInboxMissing(new NotFoundException('Inbox not found')),
        true,
      );
      assert.equal(
        isLibreDeskInboxMissing(
          new BadGatewayException('LibreDesk returned HTTP 404'),
        ),
        true,
      );
    });
  });

  describe('isCustomerCareInboundAccepted', () => {
    it('accepts a processed message', () => {
      assert.equal(
        isCustomerCareInboundAccepted({ conversation_uuid: 'conv-1' }),
        true,
      );
    });

    it('accepts stale/ignored ACK without conversation_uuid', () => {
      assert.equal(
        isCustomerCareInboundAccepted({
          ignored: 1,
          stale: true,
          duplicate: false,
        }),
        true,
      );
    });

    it('rejects an empty failure body', () => {
      assert.equal(isCustomerCareInboundAccepted({}), false);
    });
  });
});
