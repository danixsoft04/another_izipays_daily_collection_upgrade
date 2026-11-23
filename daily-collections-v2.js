/* IzyPays Daily Collections v2 enhancements. Uses the existing authenticated school session. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const db=()=>window.supabaseClient||(typeof supabaseClient!=='undefined'?supabaseClient:null);
 const sid=()=>window.currentSchool?.id||(typeof currentSchool!=='undefined'?currentSchool?.id:null);
 const studentsList=()=>((typeof students!=='undefined'?students:[])||[]).filter(s=>s.is_completed!==true);
 async function fetchActiveStudents(){const client=db(),school=sid();if(!client||!school)throw new Error('School session is not ready. Refresh and sign in again.');const {data,error}=await client.from('students').select('id,student_id,first_name,middle_name,surname,class_name,is_completed').eq('school_id',school).eq('is_completed',false);if(error)throw error;return data||[];}
 const esc=s=>typeof escapeHTML==='function'?escapeHTML(String(s??'')):String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const currency=()=>window.currentSchool?.currency_code||(typeof currentSchool!=='undefined'?currentSchool?.currency_code:'GHS')||'GHS';
 const cash=n=>typeof money==='function'?money(Number(n||0),currency()):`${currency()} ${Number(n||0).toFixed(2)}`;
 const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 const alert=(msg,type='info')=>{const target=$('dailyCollectionsAlert')||$('dailyManualPaymentAlert');if(target){target.innerHTML=`<div class="alert alert-${type} py-2" role="alert">${esc(msg)}</div>`;target.scrollIntoView?.({behavior:'smooth',block:'nearest'});}};
 async function populateV2Selectors(){
  const client=db(),school=sid();let rows=[];
  if(client&&school){const res=await client.from('students').select('id,student_id,first_name,middle_name,surname,class_name,is_completed').eq('school_id',school).eq('is_completed',false);if(res.error)throw res.error;rows=res.data||[];}
  else rows=studentsList();
  const classes=[...new Set(rows.map(x=>x.class_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const fill=(id,placeholder,items,value,label)=>{const el=$(id);if(!el)return;const old=el.value;el.innerHTML=`<option value="">${placeholder}</option>`+items.map(x=>`<option value="${esc(x[value])}">${esc(x[label])}</option>`).join('');if(items.some(x=>String(x[value])===old))el.value=old;};
  fill('dailyCollectionClass','Select class',classes.map(x=>({name:x})),'name','name');
  fill('dailyCollectionStudent','Select student',rows.map(x=>({id:x.id,label:`${[x.first_name,x.middle_name,x.surname].filter(Boolean).join(' ')} — ${x.student_id||''}`})),'id','label');
  const bulk=$('dailyCollectionBulkClass');if(bulk){const old=bulk.value;bulk.innerHTML='<option value="">Select class</option>'+classes.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');if(classes.includes(old))bulk.value=old;}
  const st=$('dailyManualStudent');if(st){const old=st.value;st.innerHTML='<option value="">Select student</option>'+rows.map(x=>`<option value="${esc(x.id)}">${esc([x.first_name,x.middle_name,x.surname].filter(Boolean).join(' '))} — ${esc(x.student_id||'')}</option>`).join('');if(rows.some(x=>x.id===old))st.value=old;}
  const ft=$('dailyManualFeeType');if(ft&&client&&school){const old=ft.value;const q=await client.from('daily_fee_types').select('id,name,amount').eq('school_id',school).eq('is_active',true).order('name');if(q.error)throw q.error;ft.innerHTML='<option value="">Select daily fee</option>'+(q.data||[]).map(x=>`<option value="${esc(x.id)}">${esc(x.name)} — ${cash(x.amount)}</option>`).join('');if((q.data||[]).some(x=>x.id===old))ft.value=old;}
  const reportFee=$('dailyCashFeeType'),historyFee=$('dailyHistoryType');
  for(const el of [reportFee,historyFee])if(el){const old=el.value;const opts=Array.from(document.querySelectorAll('#dailyCollectionType option')).filter(x=>x.value);el.innerHTML=(el===reportFee?'<option value="">All fees</option>':'<option value="">All daily fees</option>')+opts.map(x=>`<option value="${esc(x.value)}">${esc(x.textContent)}</option>`).join('');if(opts.some(x=>x.value===old))el.value=old;}
 }

 window.saveDailyFeeType=async function(ev){
  if(ev){ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation?.();}
  const client=db(),school=sid();if(!client||!school){alert('Your school session is not ready. Refresh the dashboard and sign in again.','danger');return false;}
  const button=$('dailyFeeTypeForm')?.querySelector('button[type="submit"]');if(button)button.disabled=true;
  try{
   const id=$('dailyFeeTypeEditId')?.value||'',name=$('dailyFeeTypeName')?.value.trim(),amount=Number($('dailyFeeTypeAmount')?.value),frequency=$('dailyFeeFrequency')?.value||'daily',start_date=$('dailyFeeStartDate')?.value||null,end_date=$('dailyFeeEndDate')?.value||null;
   if(!name||!Number.isFinite(amount)||amount<=0)throw new Error('Enter a valid fee name and an amount greater than zero.');
   if(start_date&&end_date&&end_date<start_date)throw new Error('End date cannot be before start date.');
   const payload={school_id:school,name,amount,frequency,start_date,end_date,track_outstanding:$('dailyFeeTrackOutstanding')?.checked??false,is_active:true,updated_at:new Date().toISOString()};
   let q=id?client.from('daily_fee_types').update(payload).eq('id',id).eq('school_id',school).select('id,name').single():client.from('daily_fee_types').insert(payload).select('id,name').single();
   const saved=await q;if(saved.error)throw saved.error;if(!saved.data?.id)throw new Error('The database did not confirm that the fee was saved.');
   $('dailyFeeTypeForm')?.reset();if($('dailyFeeTypeEditId'))$('dailyFeeTypeEditId').value='';if($('dailyFeeTypeFormTitle'))$('dailyFeeTypeFormTitle').textContent='Create Daily Fee Type';
   await loadDailyCollections();alert(id?'Daily fee configuration updated successfully.':'Daily fee configuration saved successfully.','success');
  }catch(error){alert(error?.message||'Could not save the daily fee.','danger');}
  finally{if(button)button.disabled=false;}
  return false;
 };
  window.editDailyFeeType=async function(id){const {data,error}=await db().from('daily_fee_types').select('*').eq('id',id).eq('school_id',sid()).single();if(error){alert(error.message,'danger');return;}const t=data;$('dailyFeeTypeEditId').value=t.id;$('dailyFeeTypeName').value=t.name;$('dailyFeeTypeAmount').value=t.amount;$('dailyFeeTrackOutstanding').checked=!!t.track_outstanding;$('dailyFeeFrequency').value=t.frequency||'daily';$('dailyFeeStartDate').value=t.start_date||'';$('dailyFeeEndDate').value=t.end_date||'';$('dailyFeeTypeFormTitle').textContent='Edit Daily Fee Configuration';$('dailyFeeTypeName').focus();};
 window.toggleDailyFeePause=async function(id,paused){const {error}=await db().from('daily_fee_types').update({is_paused:!!paused,updated_at:new Date().toISOString()}).eq('id',id).eq('school_id',sid());if(error){alert(error.message,'danger');return;}if(typeof loadDailyCollections==='function')await loadDailyCollections();alert(paused?'Fee schedule paused. Existing charges and payments were preserved.':'Fee schedule resumed.','success');};
 window.generateDailyFeeSchedule=async function(){
  const typeId=$('dailyCollectionType')?.value;if(!typeId){alert('Select a configured daily fee first.','warning');return;}
  const {data:t,error}=await db().from('daily_fee_types').select('*').eq('id',typeId).eq('school_id',sid()).single();if(error){alert(error.message,'danger');return;}
  if(t.is_paused){alert('This fee configuration is paused. Resume it before generating new charges.','warning');return;}if(!t.start_date||!t.end_date){alert('Set both start and end dates in the fee configuration first.','warning');return;}
  const start=new Date(t.start_date+'T12:00:00'),end=new Date(t.end_date+'T12:00:00');if(end<start){alert('The configured end date is before the start date.','warning');return;}
  const allStudents=await fetchActiveStudents();await populateV2Selectors();let targets=allStudents;const scope=$('dailyCollectionTarget')?.value||'school';if(scope==='class'){const cls=$('dailyCollectionClass')?.value;if(!cls){alert('Choose a class in the Assign a Daily Collection section first.','warning');return;}targets=targets.filter(s=>s.class_name===cls);}else if(scope==='student'){const studentId=$('dailyCollectionStudent')?.value;if(!studentId){alert('Choose a student in the Assign a Daily Collection section first.','warning');return;}targets=targets.filter(s=>s.id===studentId);}
  if(!targets.length){alert('No active students match this fee configuration.','warning');return;}
  const dates=[];for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
   const day=d.getDay();const date=d.toISOString().slice(0,10);let include=false;
   if(t.frequency==='daily')include=(t.weekdays||[1,2,3,4,5]).includes(day===0?7:day);
   else if(t.frequency==='weekly')include=day===start.getDay();
   else if(t.frequency==='monthly')include=d.getDate()===start.getDate();
   else if(t.frequency==='once')include=date===t.start_date;
   if(include)dates.push(date);if(t.frequency==='once')break;
  }
  if(!dates.length){alert('No dates were generated. Check the configured period.','warning');return;}
  if(dates.length*targets.length>15000){alert('This configuration creates too many records in one operation. Shorten the period and generate in smaller batches.','warning');return;}
  const year=(typeof currentSchool!=='undefined'&&currentSchool?.current_academic_year)||null;const term=$('dailyCollectionTerm')?.value||null;const records=[];
  for(const date of dates)for(const st of targets)records.push({school_id:sid(),daily_fee_type_id:t.id,student_id:st.id,collection_date:date,academic_year:year,term,amount:Number(t.amount),status:'unpaid',amount_paid:0,waived_amount:0,recorded_by:(typeof currentUser!=='undefined'?currentUser?.id:null)});
  const {error:upErr}=await db().from('daily_collection_records').upsert(records,{onConflict:'school_id,daily_fee_type_id,student_id,collection_date',ignoreDuplicates:true});if(upErr){alert(upErr.message,'danger');return;}
  for(const st of targets){const applied=await db().rpc('apply_daily_prepaid_balance',{p_student_id:st.id,p_daily_fee_type_id:t.id});if(applied.error){alert('Charges were generated, but advance allocation needs attention: '+applied.error.message,'warning');return;}}
  $('dailyCollectionDate').value=t.start_date; if(typeof refreshDailyCollections==='function')await refreshDailyCollections();alert(`Generated ${dates.length} charge date(s) for ${targets.length} student(s). Existing records were preserved.`,'success');
 };
 window.assignDailyCollection=async function(){
  const client=db(),school=sid();if(!client||!school){alert('Your school session is not ready. Refresh the dashboard and try again.','danger');return;}
  try{
   const typeId=$('dailyCollectionType')?.value;if(!typeId){alert('Select a daily fee first.','warning');return;}
   const {data:type,error:typeError}=await client.from('daily_fee_types').select('id,name,amount,is_active').eq('id',typeId).eq('school_id',school).single();if(typeError)throw typeError;
   if(!type.is_active){alert('This daily fee is inactive. Activate it before assigning.','warning');return;}
   const all=await fetchActiveStudents();const scope=$('dailyCollectionTarget')?.value||'school';let selected=all;
   if(scope==='class'){const cls=$('dailyCollectionClass')?.value;if(!cls){alert('Select a class.','warning');return;}selected=all.filter(x=>x.class_name===cls);}
   else if(scope==='student'){const studentId=$('dailyCollectionStudent')?.value;if(!studentId){alert('Select a student.','warning');return;}selected=all.filter(x=>x.id===studentId);}
   if(!selected.length){alert('No active students match this assignment.','warning');return;}
   const date=$('dailyCollectionDate')?.value||today();const year=$('dailyCollectionYear')?.value.trim()||((typeof currentSchool!=='undefined'&&currentSchool?.current_academic_year)||null);const term=$('dailyCollectionTerm')?.value.trim()||((typeof currentSchool!=='undefined'&&currentSchool?.current_term)||null);
   const records=selected.map(st=>({school_id:school,daily_fee_type_id:type.id,student_id:st.id,collection_date:date,academic_year:year,term,amount:Number(type.amount),amount_paid:0,waived_amount:0,status:'unpaid',recorded_by:(typeof currentUser!=='undefined'?currentUser?.id:null)}));
   const {error}=await client.from('daily_collection_records').upsert(records,{onConflict:'school_id,daily_fee_type_id,student_id,collection_date',ignoreDuplicates:true});if(error)throw error;
   alert(`${selected.length} student(s) assigned successfully for ${date}. Existing records were not overwritten.`,'success');if(typeof refreshDailyCollections==='function')await refreshDailyCollections();
  }catch(error){alert(error?.message||'Could not assign the daily fee.','danger');}
 };
 window.waiveDailyCharge=async function(recordId,remaining){const amountText=prompt(`Enter waiver amount (maximum ${Number(remaining).toFixed(2)}):`,Number(remaining).toFixed(2));if(amountText===null)return;const amount=Number(amountText);if(!Number.isFinite(amount)||amount<=0||amount>Number(remaining)){alert('Enter a valid waiver amount not exceeding the outstanding balance.','warning');return;}const reason=prompt('Enter the reason for this waiver:');if(!reason||!reason.trim()){alert('A waiver reason is required.','warning');return;}const {error}=await db().rpc('waive_daily_collection_record',{p_record_id:recordId,p_amount:amount,p_reason:reason.trim()});if(error){alert(error.message,'danger');return;}alert('Charge waiver recorded with reason.','success');if(typeof refreshDailyCollections==='function')await refreshDailyCollections();};
 window.openDailyManualPayment=async function(){
  try{await populateV2Selectors();}catch(e){alert('Could not load the student and fee lists: '+(e.message||e),'danger');return;}
  if($('dailyManualDate'))$('dailyManualDate').value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
  bootstrap.Modal.getOrCreateInstance($('dailyManualPaymentModal')).show();
 };
  window.saveDailyManualPayment=async function(ev){
  if(ev){ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation?.();}
  const button=$('dailyManualSaveButton');
  const student=$('dailyManualStudent')?.value,fee=$('dailyManualFeeType')?.value;
  const amount=Number($('dailyManualAmount')?.value),method=$('dailyManualMethod')?.value;
  const paidAt=$('dailyManualDate')?.value,notes=$('dailyManualNotes')?.value?.trim()||'';
  if(!student||!fee||!Number.isFinite(amount)||amount<=0){alert('Select a student and fee, then enter a valid amount.','warning');return false;}
  if(!db()||!sid()){alert('Your school session is not ready. Refresh the dashboard and sign in again.','danger');return false;}
  if(button)button.disabled=true;
  try{
   // The receipt RPC is the save operation. Once it succeeds, never report it as
   // failed merely because a later allocation or screen refresh has a problem.
   const {data,error}=await db().rpc('record_daily_manual_payment',{
    p_student_id:student,p_daily_fee_type_id:fee,p_amount:amount,p_payment_method:method,
    p_paid_at:paidAt?new Date(paidAt).toISOString():new Date().toISOString(),p_notes:notes||null
   });
   if(error)throw error;
   const row=Array.isArray(data)?data[0]:data;
   const reference=row?.payment_reference||'recorded';
   $('dailyManualAmount').value='';$('dailyManualNotes').value='';
   bootstrap.Modal.getInstance($('dailyManualPaymentModal'))?.hide();
   alert(`Payment saved successfully. Receipt reference: ${reference}.`,'success');
   // Allocation is a separate follow-up; it must not undo or misreport a saved receipt.
   try{
    const alloc=await db().rpc('apply_daily_prepaid_balance',{p_student_id:student,p_daily_fee_type_id:fee});
    if(alloc.error)alert(`Receipt ${reference} was saved, but automatic allocation needs attention: ${alloc.error.message}`,'warning');
   }catch(allocationError){alert(`Receipt ${reference} was saved. Automatic allocation could not be completed: ${allocationError.message||allocationError}`,'warning');}
   try{if(typeof refreshDailyCollections==='function')await refreshDailyCollections();}catch(refreshError){console.error('Daily collections refresh:',refreshError);}
   try{await loadDailyCashReport();}catch(reportError){console.error('Daily cash report refresh:',reportError);}
  }catch(e){alert(e?.message||'Unable to save the daily receipt.','danger');}
  finally{if(button)button.disabled=false;}
  return false;
 };
 window.loadDailyCashReport=async function(){const el=$('dailyCashReportNote'),body=$('dailyCashReportRows');try{let q=db().from('daily_collection_payments').select('*,students(student_id,first_name,middle_name,surname,class_name),daily_fee_types(name)').eq('school_id',sid()).eq('status','success').order('paid_at',{ascending:false});const from=$('dailyCashFrom')?.value,to=$('dailyCashTo')?.value,method=$('dailyCashMethod')?.value,fee=$('dailyCashFeeType')?.value;if(from)q=q.gte('paid_at',from+'T00:00:00');if(to)q=q.lte('paid_at',to+'T23:59:59');if(method)q=q.eq('payment_method',method);if(fee)q=q.eq('daily_fee_type_id',fee);const {data,error}=await q.limit(2000);if(error)throw error;const rows=data||[];const ids=rows.map(x=>x.id);let allocations=[];if(ids.length){const a=await db().from('daily_collection_payment_allocations').select('payment_id,amount').in('payment_id',ids);if(a.error)throw a.error;allocations=a.data||[];}const allocated=new Map();allocations.forEach(a=>allocated.set(a.payment_id,(allocated.get(a.payment_id)||0)+Number(a.amount||0)));const sum=k=>rows.reduce((a,r)=>a+Number(r[k]||0),0);$('dailyCashGross').textContent=cash(sum('amount'));$('dailyCashServiceFee').textContent=cash(sum('service_fee'));$('dailyCashGatewayFee').textContent=cash(sum('gateway_fee'));$('dailyCashNet').textContent=cash(sum('net_school_amount'));if(body)body.innerHTML=rows.length?rows.map(r=>{const st=r.students||{};const name=[st.first_name,st.middle_name,st.surname].filter(Boolean).join(' ');const advance=Math.max(Number(r.amount||0)-Number(allocated.get(r.id)||0),0);return `<tr><td>${esc(new Date(r.paid_at).toLocaleString())}</td><td>${esc(r.reference)}</td><td>${esc(name)} <small class="d-block text-muted">${esc(st.student_id||'')}</small></td><td>${esc(r.daily_fee_types?.name||'-')}</td><td>${esc((r.payment_method||'').replaceAll('_',' '))}</td><td>${cash(r.amount)}</td><td>${cash(r.service_fee)}</td><td>${cash(r.gateway_fee)}</td><td>${cash(r.net_school_amount)}</td><td>${cash(advance)}</td></tr>`;}).join(''):'<tr><td colspan="10" class="text-muted">No receipts match these filters.</td></tr>';if(el)el.textContent=`Showing ${rows.length} receipt(s). Totals use actual receipt dates; future allocations are not counted as new income.`;}catch(e){if(el)el.textContent='Receipt report is not available: '+e.message;if(body)body.innerHTML='<tr><td colspan="10" class="text-danger">Could not load receipt details.</td></tr>';}};
  async function loadAcademicYears(){
  const client=db(),school=sid();if(!client||!school)return;
  if($('academicYearName')&&!$('academicYearName').value){const current=(typeof currentSchool!=='undefined'&&currentSchool?.current_academic_year)||'';const match=current.match(/^(\d{4})\/(\d{4})$/);$('academicYearName').value=match?`${Number(match[1])+1}/${Number(match[2])+1}`:current||`${new Date().getFullYear()}/${new Date().getFullYear()+1}`;}
  const {data,error}=await client.from('academic_years').select('*').eq('school_id',school).order('created_at',{ascending:false});if(error)throw error;
  const rows=data||[];const select=$('academicYearSelect');if(select){const active=(typeof currentSchool!=='undefined'&&currentSchool?.active_academic_year_id)||rows.find(x=>x.is_active)?.id||'';select.innerHTML='<option value="">Select academic year</option>'+rows.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}${x.is_active?' (Active)':''}</option>`).join('');select.value=active||rows[0]?.id||'';}
  const activeYear=rows.find(x=>x.is_active);if($('activeAcademicYearBadge'))$('activeAcademicYearBadge').textContent=activeYear?`Active: ${activeYear.name}`:'No active academic year';
  if(activeYear){if($('dailyCollectionYear')&&!$('dailyCollectionYear').value)$('dailyCollectionYear').value=activeYear.name;if($('dailyHistoryYear')&&!$('dailyHistoryYear').value)$('dailyHistoryYear').value=activeYear.name;if($('assignYear')&&!$('assignYear').value)$('assignYear').value=activeYear.name;if($('academicYearDashboardFilter')&&!$('academicYearDashboardFilter').value)$('academicYearDashboardFilter').value=activeYear.name;}
  await loadAcademicTerms();if(typeof currentSchool!=='undefined'&&currentSchool?.current_term){if($('dailyCollectionTerm')&&!$('dailyCollectionTerm').value)$('dailyCollectionTerm').value=currentSchool.current_term;if($('dailyHistoryTerm')&&!$('dailyHistoryTerm').value)$('dailyHistoryTerm').value=currentSchool.current_term;if($('assignTerm')&&!$('assignTerm').value)$('assignTerm').value=currentSchool.current_term;}
 }
 async function loadAcademicTerms(){const year=$('academicYearSelect')?.value;if(!$('academicTermSelect'))return;$('academicTermSelect').innerHTML='<option value="">Select term</option>';if(!year)return;const {data,error}=await db().from('academic_year_terms').select('*').eq('academic_year_id',year).eq('school_id',sid()).order('created_at');if(error)throw error;$('academicTermSelect').innerHTML='<option value="">Select term</option>'+(data||[]).map(t=>`<option value="${esc(t.name)}" ${t.is_active?'selected':''}>${esc(t.name)}${t.is_active?' (Active)':''}</option>`).join('');}
 window.createAcademicYear=async function(){const name=$('academicYearName')?.value.trim();const start_date=$('academicYearStart')?.value||null;const end_date=$('academicYearEnd')?.value||null;if(!name){alert('Enter an academic year name.','warning');return;}if(start_date&&end_date&&end_date<start_date){alert('End date cannot be before start date.','warning');return;}const {error}=await db().from('academic_years').insert({school_id:sid(),name,start_date,end_date,is_active:false});if(error){alert(error.message,'danger');return;} $('academicYearName').value='';await loadAcademicYears();alert('Academic year created. Select it and set it active when ready.','success');};
 window.createAcademicTerm=async function(){const academic_year_id=$('academicYearSelect')?.value;const name=$('academicTermName')?.value.trim();const start_date=$('academicTermStart')?.value||null;const end_date=$('academicTermEnd')?.value||null;if(!academic_year_id||!name){alert('Select an academic year and enter a term name.','warning');return;}if(start_date&&end_date&&end_date<start_date){alert('Term end date cannot be before its start date.','warning');return;}const {error}=await db().from('academic_year_terms').insert({school_id:sid(),academic_year_id,name,start_date,end_date,is_active:false});if(error){alert(error.message,'danger');return;} $('academicTermName').value='';await loadAcademicTerms();alert('Term added to the selected academic year.','success');};
 window.setActiveAcademicPeriod=async function(){const academic_year_id=$('academicYearSelect')?.value;const term=$('academicTermSelect')?.value||null;if(!academic_year_id){alert('Select an academic year first.','warning');return;}const {data:year,error:yErr}=await db().from('academic_years').select('name').eq('id',academic_year_id).eq('school_id',sid()).single();if(yErr)throw yErr;const {error}=await db().rpc('set_active_academic_period',{p_academic_year_id:academic_year_id,p_term_name:term});if(error){alert(error.message,'danger');return;}if(typeof currentSchool!=='undefined'){currentSchool.current_academic_year=year.name;currentSchool.current_term=term;currentSchool.active_academic_year_id=academic_year_id;}if($('dailyCollectionYear'))$('dailyCollectionYear').value=year.name;if($('dailyCollectionTerm'))$('dailyCollectionTerm').value=term||'';if($('assignYear'))$('assignYear').value=year.name;if($('assignTerm'))$('assignTerm').value=term||'';await loadAcademicYears();alert('Active academic year and term updated. Historical records were not changed.','success');};
 document.addEventListener('change',e=>{if(e.target?.id==='academicYearSelect')loadAcademicTerms().catch(err=>alert(err.message,'danger'));if(e.target?.id==='dailyCollectionTarget'){$('dailyCollectionClassWrap')?.classList.toggle('d-none',e.target.value!=='class');$('dailyCollectionStudentWrap')?.classList.toggle('d-none',e.target.value!=='student');}});
 function bindDailyFeeForm(){const form=$('dailyFeeTypeForm');if(form&&!form.dataset.dailyFeeSubmitBound){form.dataset.dailyFeeSubmitBound='1';form.addEventListener('submit',ev=>window.saveDailyFeeType(ev),true);}const target=$('dailyCollectionTarget');if(target){$('dailyCollectionClassWrap')?.classList.toggle('d-none',target.value!=='class');$('dailyCollectionStudentWrap')?.classList.toggle('d-none',target.value!=='student');}}
 bindDailyFeeForm();document.addEventListener('DOMContentLoaded',bindDailyFeeForm);
 document.addEventListener('change',e=>{if(e.target?.id==='dailyCollectionTarget')populateV2Selectors().catch(err=>alert('Student/class dropdowns could not load: '+err.message,'danger'));});
 const oldLoad=window.loadDailyCollections;window.loadDailyCollections=async function(){if(oldLoad)await oldLoad();try{await populateV2Selectors();}catch(e){alert('Student/class dropdowns could not load: '+e.message,'danger');}await loadDailyCashReport();try{await loadAcademicYears();if($('dailyCollectionTerm')&&!$('dailyCollectionTerm').value&&typeof currentSchool!=='undefined')$('dailyCollectionTerm').value=currentSchool?.current_term||'';}catch(e){alert('Academic year settings could not load: '+e.message,'warning');}};
})();
 // Prevent legacy one-click status changes from falsely reporting cash without a receipt.
 const oldSetStatus=window.setDailyCollectionStatus;
 window.setDailyCollectionStatus=async function(id,status){if(status==='paid'){alert('To mark a daily charge paid, record the actual payment in “Record Manual / Advance Payment” so IzyPays creates a receipt and collection record.','warning');return;}if(oldSetStatus)return oldSetStatus(id,status);};
 const oldBulkStatus=window.bulkDailyCollectionStatus;
 window.bulkDailyCollectionStatus=async function(status,scope){if(status==='paid'){alert('Bulk “Mark Paid” is disabled to protect collection records. Record each actual receipt so the cash report remains accurate.','warning');return;}if(oldBulkStatus)return oldBulkStatus(status,scope);};