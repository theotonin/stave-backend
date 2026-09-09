import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { normalizeProjectFinance, serializeProject, parseProjectDate } from '../src/utils/projectFinance.js';

test('campos omitidos são preservados e campos vazios podem ser limpos', () => {
  assert.deepEqual(normalizeProjectFinance({ status: 'Concluído' }), {});
  assert.deepEqual(normalizeProjectFinance({budgetAmount:null, paymentAmount:'', paymentDate:null}), {
    budgetAmount:null, paymentAmount:null, paymentDate:null,
  });
});

test('valores monetários mantêm centavos, aceitam zero e limite do banco', () => {
  assert.deepEqual(normalizeProjectFinance({budgetAmount:'9999999999.99',paymentAmount:0}), {
    budgetAmount:'9999999999.99',paymentAmount:'0',
  });
  assert.equal(normalizeProjectFinance({paymentAmount:'0.01'}).paymentAmount,'0.01');
  for(const value of [-1,'-0.01','1.001','10000000000','1,20','1e3',true,[],{},NaN,Infinity,' ']) {
    assert.throws(() => normalizeProjectFinance({paymentAmount:value}), {statusCode:400});
    assert.throws(() => normalizeProjectFinance({budgetAmount:value}), {statusCode:400});
  }
});

test('dia do pagamento valida calendário e não depende do fuso horário', () => {
  assert.equal(normalizeProjectFinance({paymentDate:'2028-02-29T14:30:00-03:00'}).paymentDate.toISOString(),'2028-02-29T17:30:00.000Z');
  for(const value of ['2026-02-29','2026-04-31','2026-13-01','2026-09-09','2026-09-09T25:00:00Z','2026-02-30T10:00:00Z','09/09/2026','0000-01-01',123,{}]) {
    assert.throws(() => normalizeProjectFinance({paymentDate:value}), {statusCode:400});
  }
});

test('GET/POST/PUT usam strings decimais e data com horário UTC no JSON', () => {
  const project=serializeProject({id:'example',budgetAmount:new Prisma.Decimal('1500.1'),paymentAmount:new Prisma.Decimal(0),paymentDate:new Date('2026-09-09T00:00:00Z')});
  assert.deepEqual(project,{id:'example',scheduledTo:null,budgetAmount:'1500.10',paymentAmount:'0.00',paymentDate:'2026-09-09T00:00:00.000Z'});
  assert.deepEqual(serializeProject({id:'legacy'}),{id:'legacy',scheduledTo:null,budgetAmount:null,paymentAmount:null,paymentDate:null});
});


test('entrega preserva horário e exige data válida com fuso', () => {
  assert.equal(parseProjectDate('2028-02-29T14:30:00-03:00', 'Data de entrega').toISOString(), '2028-02-29T17:30:00.000Z');
  assert.equal(serializeProject({scheduledTo:parseProjectDate('2026-09-09T12:45:00Z')}).scheduledTo, '2026-09-09T12:45:00.000Z');
  assert.equal(parseProjectDate(null), null);
  for (const value of ['2026-02-29T12:00:00Z', '2026-09-09', '09/09/2026', '2026-09-09T12:00', '2026-09-09T24:00:00Z']) {
    assert.throws(() => parseProjectDate(value, 'Data de entrega'), {statusCode:400});
  }
});
