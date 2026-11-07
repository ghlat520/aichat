const { store, getApiClient, ApiClientError, syncTabBar } = require('../../app-store');
const { getDiary, localDate } = require('../../diary-store');
const { getPractice, setFlowIntent } = require('../../practice-store');
const UI = require('../../growth-ui-data.js');
function owner() { const session=store.getState().session; return `${store.getLogoutVersion()}:${session ? session.sessionId : 'preview'}`; }
Page({
  data:{loading:false,error:'',productName:'',panel:'home',images:UI.images,chapterIcons:UI.chapterIcons,zodiacViewed:false,zodiacId:'aries',zodiacIndex:0,zodiacSelectorOpen:false,signs:UI.signs.map((sign,index)=>({...sign,left:50+Math.sin(index*Math.PI/6)*37,top:50-Math.cos(index*Math.PI/6)*37})),selectedSign:UI.signs[0],next:null,recent:null},
  onLoad(){this.loadAppConfig();},
  onShow(){syncTabBar(this,0);const current=owner();if(this.owner&&this.owner!==current)this.setData({panel:'home',zodiacViewed:false,zodiacId:'aries',zodiacIndex:0,zodiacSelectorOpen:false,selectedSign:UI.signs[0]});this.owner=current;this.setData({panel:'home',zodiacSelectorOpen:false});this.refreshHome();},
  async loadAppConfig(){try{const response=await getApiClient().getAppConfig();const cfg=response.data;store.setAppConfig(cfg);this.setData({productName:cfg.product_name||'',error:''});}catch(error){this.setData({error:this.friendlyError(error)});}},
  refreshHome(){
    const diary=getDiary(owner()).get(),practice=getPractice(owner()).get(),today=diary.entries.find(entry=>entry.date===localDate()),c=practice.current;
    const hasDraft=Boolean(diary.draft.content.trim()||diary.draft.id||diary.draft.mood||diary.draft.dimensions.length||diary.draft.inspiration);
    let next={tone:'blue',title:['有些心里话，','值得被听见。'],description:'开心、委屈，或还说不清的感受，都值得留一点位置。三行字，慢慢读懂自己。',action:'写给此刻的自己',kind:'write',art:UI.images.journal,status:''};
    if(hasDraft)next={tone:'mint',title:['刚才的心里话，','留给你慢慢写。'],description:'刚才写下的都还在。从停下的那一句，继续听听自己的感受。',action:'继续三行觉察',kind:'write',art:UI.images.journal,status:'有一份觉察草稿'};
    else if(practice.active&&!practice.reviewed)next={tone:'peach',title:practice.planReady?['把这一步，','带到生活里。']:['不用一下变好，','先试一点不同。'],description:practice.planReady?`你准备尝试：${c.what}。尝试之后，再回来留一句反馈。`:'继续已写下的内容，选一个容易开始的小动作。',action:practice.planReady?'查看微行动与复盘':'继续我的微行动',kind:'practice',art:UI.images.feedback,status:practice.planReady?'我的行动已准备好':'继续上次的练习'};
    else if(practice.reviewed&&(!today||!c.sourceDiaryId||c.sourceDiaryId===today.id))next={tone:'peach',title:['这次的发现，','留给下次的你。'],description:`你想继续尝试：${c.next}`,action:'回看三问复盘',kind:'review',art:UI.images.feedback,status:'这次复盘已保存'};
    else if(today)next={tone:'mint',title:['听见自己以后，','试着回应自己。'],description:'你已经留意到自己的感受。选一个愿意试的小动作，让这份理解照顾到真实的生活。',action:'选一个微行动',kind:'from-diary',entryId:today.id,art:UI.images.journal,status:'今天的觉察已记录'};
    const recent=diary.entries[0];this.setData({next,dateLabel:`${new Date().getMonth()+1}月${new Date().getDate()}日`,recent:recent?{...recent,dateLabel:`${Number(recent.date.slice(5,7))} 月 ${Number(recent.date.slice(8))} 日`,excerpt:recent.content.slice(0,100)}:null});
  },
  checkOwner(){if(this.owner===owner())return true;this.onShow();return false;},
  goNext(){if(!this.checkOwner())return;const next=this.data.next;if(next.kind==='write')this.goDiary();else if(next.kind==='from-diary'){const entry=getDiary(owner()).get().entries.find(row=>row.id===next.entryId);if(entry){try{getPractice(owner()).fromDiary(entry);}catch(error){if(error.code!=='ACTIVE_PRACTICE')throw error;wx.showToast({title:'先继续已有微行动，觉察仍保留',icon:'none'});}}this.goVenting();}else if(next.kind==='review')this.goReview();else this.goVenting();},
  goDiary(){if(!this.checkOwner())return;setFlowIntent(owner(),{target:'diary',type:'write'});wx.switchTab({url:'/pages/diary/diary'});},
  goRecent(){if(!this.checkOwner()||!this.data.recent)return;setFlowIntent(owner(),{target:'diary',type:'entry',id:this.data.recent.id});wx.switchTab({url:'/pages/diary/diary'});},
  goJournal(){if(!this.checkOwner())return;setFlowIntent(owner(),{target:'diary',type:'journal'});wx.switchTab({url:'/pages/diary/diary'});},
  goAssessment(){wx.switchTab({url:'/pages/assessment/assessment'});},
  goVenting(){if(!this.checkOwner())return;setFlowIntent(owner(),{target:'practice',type:'plan'});wx.switchTab({url:'/pages/venting/venting'});},
  goReview(){if(!this.checkOwner())return;setFlowIntent(owner(),{target:'practice',type:'review'});wx.switchTab({url:'/pages/venting/venting'});},
  goReports(){wx.navigateTo({url:'/pages/reports/reports'});},
  goProfile(){wx.switchTab({url:'/pages/profile/profile'});},
  goZodiac(){if(this.checkOwner())this.setData({panel:'zodiac',zodiacViewed:true,zodiacSelectorOpen:false});},
  closeZodiac(){if(this.checkOwner()){this.setData({panel:'home',zodiacSelectorOpen:false});this.refreshHome();}},
  setZodiacIndex(index){
    if(!this.checkOwner()||this.data.panel!=='zodiac'||!Number.isInteger(index)||!UI.signs[index])return;
    const sign=UI.signs[index];
    this.setData({zodiacId:sign.id,zodiacIndex:index,selectedSign:sign,zodiacViewed:true,zodiacSelectorOpen:false});
  },
  selectSign(event){this.setZodiacIndex(UI.signs.findIndex(row=>row.id===event.currentTarget.dataset.id));},
  stepZodiac(event){const step=Number(event.currentTarget.dataset.step);if(step===1||step===-1)this.setZodiacIndex((this.data.zodiacIndex+step+12)%12);},
  onZodiacSwipe(event){if(event.detail.source==='touch')this.setZodiacIndex(Number(event.detail.current));},
  toggleZodiacSelector(){if(this.checkOwner()&&this.data.panel==='zodiac')this.setData({zodiacSelectorOpen:!this.data.zodiacSelectorOpen});},
  writeFromSign(){if(!this.checkOwner()||this.data.panel!=='zodiac')return;const sign=this.data.selectedSign;getDiary(owner()).updateDraft({inspiration:{source:`星座图鉴 · ${sign.name}`,question:sign.question}});this.goDiary();},
  friendlyError(error){return error instanceof ApiClientError?error.apiError.message||'请求失败':error&&error.message||'配置服务暂不可用';}
});
