import test from 'node:test';
import assert from 'node:assert/strict';
import {selectProvider,parseSuggestions} from '../functions/_lib/resume-ai-provider.js';

test('provider selection uses server-only configuration',()=>{
 const env={HHBA_AI_DEFAULT_PROVIDER:'openai',HHBA_AI_OPENAI_API_KEY:'placeholder',
  HHBA_AI_OPENAI_MODEL:'configured-model'};
 const result=selectProvider(env);
 assert.equal(result.name,'openai');
 assert.equal(result.protocol,'openai');
 assert.equal(result.model,'configured-model');
 assert.throws(()=>selectProvider({HHBA_AI_DEFAULT_PROVIDER:'unknown'}),/UNSUPPORTED/);
 assert.throws(()=>selectProvider({HHBA_AI_DEFAULT_PROVIDER:'openai'}),/NOT_CONFIGURED/);
});
test('AI response validates block references and suggestion shape',()=>{
 const suggestion={id:'a',blockId:'experience-0',action:'replace',
  original:'已有经历',proposed:'经过润色的已有经历',
  rationale:'表达更清晰',jobRequirement:'门店运营',
  evidenceStatus:'needs_user_confirmation'};
 assert.equal(parseSuggestions({suggestions:[suggestion]},['experience-0']).length,1);
 assert.throws(()=>parseSuggestions({suggestions:[{...suggestion,blockId:'not-owned'}]},['experience-0']));
 assert.throws(()=>parseSuggestions({suggestions:[{...suggestion,action:'invent'}]},['experience-0']));
});
