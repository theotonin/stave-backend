import { createSession } from "../src/services/sessionService.js";
// Executar explicitamente com npm run test:integration.
// Cria dados identificados para este teste no DATABASE_URL e os remove no finally.
import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import app from '../src/app.js';
import prisma from '../src/config/database.js';

test('API persiste orçamento/pagamento e preserva campos em outros PUTs', {timeout:120000}, async () => {
  const userId=randomUUID();
  const projectIds=[];
  let sessionToken;
  const server=app.listen(0,'127.0.0.1');
  await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  async function request(path, method='GET', body) {
    const response=await fetch(`${base}${path}`,{
      method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${sessionToken}`},
      ...(body !== undefined && {body:JSON.stringify(body)}),
    });
    return {status:response.status,data:await response.json()};
  }
  const finance={budgetAmount:'1500.10',paymentAmount:'750.05',paymentDate:'2026-09-09T17:30:00.000Z'};
  function checkFinance(project,expected=finance) {
    for(const field of Object.keys(finance)) assert.equal(project[field],expected[field],field);
  }
  try {
    await prisma.user.create({data:{id:userId,name:'Teste financeiro automatizado',username:`test-${userId}`,email:`${userId}@example.invalid`,password:randomUUID()}});
    sessionToken=await createSession(userId);
    const input={name:`Teste financeiro ${userId}`,members:[userId],type:['Composição'],status:'Em andamento',description:'Fixture temporária',scheduledTo:'2026-10-01T21:45:00.000Z'};
    const created=await request('/projects','POST',{...input,...finance});
    if(created.data.project?.id) projectIds.push(created.data.project.id);
    assert.equal(created.status,201);
    checkFinance(created.data.project);
    assert.equal(created.data.project.scheduledTo, input.scheduledTo);
    const id=created.data.project.id;
    const stored=await prisma.project.findUniqueOrThrow({where:{id}});
    assert.equal(stored.budgetAmount.toFixed(2),finance.budgetAmount);
    assert.equal(stored.paymentDate.toISOString(),'2026-09-09T17:30:00.000Z');

    for(const path of [`/projects/${id}`,'/projects','/projects/userProjects']) {
      const result=await request(path);
      assert.equal(result.status,200);
      const returned = result.data.project ?? result.data.projects.find(p=>p.id===id);
      checkFinance(returned);
      assert.equal(returned.scheduledTo, input.scheduledTo);
    }
    // Mesmo payload usado para concluir pelo dashboard e para salvar membros.
    for(const body of [{...input,status:'Concluído'}, {...input,members:[userId]}, {status:'Em andamento'}]) {
      const result=await request(`/projects/${id}`,'PUT',body);
      assert.equal(result.status,200);
      checkFinance(result.data.project);
      assert.equal(result.data.project.scheduledTo, input.scheduledTo);
    }
    const edited=await request(`/projects/${id}`,'PUT',{...input,budgetAmount:'9999999999.99',paymentAmount:'0',paymentDate:'2028-02-29T14:15:00.000Z'});
    assert.equal(edited.status,200);
    checkFinance(edited.data.project,{budgetAmount:'9999999999.99',paymentAmount:'0.00',paymentDate:'2028-02-29T14:15:00.000Z'});
    for(const invalid of [{paymentAmount:'-1'},{budgetAmount:'1.999'},{paymentDate:'2026-02-30'}, {scheduledTo:'2026-02-30'}, {scheduledTo:'2026-09-09'}, {scheduledTo:'2026-09-09T25:00:00Z'}]) {
      const result=await request(`/projects/${id}`,'PUT',{...input,...invalid});
      assert.equal(result.status,400);
    }
    const unchanged=await request(`/projects/${id}`);
    checkFinance(unchanged.data.project,{budgetAmount:'9999999999.99',paymentAmount:'0.00',paymentDate:'2028-02-29T14:15:00.000Z'});
    const cleared=await request(`/projects/${id}`,'PUT',{...input,budgetAmount:null,paymentAmount:null,paymentDate:null});
    assert.equal(cleared.status,200);
    checkFinance(cleared.data.project,{budgetAmount:null,paymentAmount:null,paymentDate:null});

    const legacy=await request('/projects','POST',input);
    if(legacy.data.project?.id) projectIds.push(legacy.data.project.id);
    assert.equal(legacy.status,201);
    checkFinance(legacy.data.project,{budgetAmount:null,paymentAmount:null,paymentDate:null});
    const clearedDate = await request(`/projects/${id}`, 'PUT', {scheduledTo:null});
    assert.equal(clearedDate.status,200);
    assert.equal(clearedDate.data.project.scheduledTo,null);
    const badCreate=await request('/projects','POST',{...input,paymentAmount:'-1'});
    if(badCreate.data.project?.id) projectIds.push(badCreate.data.project.id);
    assert.equal(badCreate.status,400);
  } finally {
    try {
      await prisma.project.deleteMany({where:{id:{in:projectIds}}});
      await prisma.user.deleteMany({where:{id:userId}});
    } finally {
      server.closeAllConnections();
      await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
      await prisma.$disconnect();
    }
  }
});
