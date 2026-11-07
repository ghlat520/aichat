// A light reference companion: chosen observations, never a generated personal forecast.
(() => {
  const traitMeta = [{"id": "leadership", "label": "领导力", "meaning": "如何带动他人"}, {"id": "affinity", "label": "亲和力", "meaning": "如何拉近距离"}, {"id": "execution", "label": "执行力", "meaning": "如何推进事情"}, {"id": "creativity", "label": "创造力", "meaning": "如何提出新想法"}];
  const profiles = {
  "aries": {
    "headline": "想到了，\n就去试试看",
    "personality": {
      "title": "热情里的行动派",
      "body": "有了喜欢的事，就想马上去试；遇到不认同的，也很难装作无所谓。白羊的常见解读把这种直接与热情放在前面。它让人看见勇气，也提醒人给耐心留一点位置。"
    },
    "strength": {
      "title": "敢开始，也敢表达",
      "body": "需要有人开头、表态或打破僵局时，这份主动很容易带动气氛。"
    },
    "blindspot": {
      "title": "给耐心留个位置",
      "body": "速度快时，容易跳过准备或听完别人的意见。收尾也需要被认真照顾。"
    },
    "career": {
      "title": "在开局时找到存在感",
      "body": "别人还在观望时，愿意先提一个方案、做出第一版，这份主动很珍贵。项目启动、短周期尝试，往往更能承接这种热情。把交接与收尾也安排进去，会让“敢开始”多一份可靠。",
      "scenes": [
        "项目启动",
        "短周期试验",
        "明确分工"
      ]
    },
    "money": {
      "title": "机会感强，决定也快",
      "body": "比起等机会，更愿意主动争取；看到喜欢的，也容易马上做决定。这种爽快有它的魅力。回看一次临时支出：买下的是实际需要，还是那一刻想犒劳自己的心情？"
    },
    "traits": [
      {
        "style": "先行带动",
        "body": "愿意先承担第一步，让团队看见事情可以怎样开始；听取不同意见，会让带动更稳。"
      },
      {
        "style": "直接热情",
        "body": "常用主动招呼和坦率表达拉近距离。留意对方的节奏，热情才更容易被接住。"
      },
      {
        "style": "迅速启动",
        "body": "把想法转成动作的速度较快；为检查、收尾留出安排，能让开始有更好的结果。"
      },
      {
        "style": "边做边试",
        "body": "新的点子往往在尝试中出现。保留一次小试验的空间，比急着一次定型更合拍。"
      }
    ]
  },
  "taurus": {
    "headline": "慢慢来，\n也能走得很远",
    "personality": {
      "title": "在稳定里积累力量",
      "body": "嘴上不一定说很多，却愿意把日子一点点经营好。金牛的常见解读看重稳定、质感与兑现：一顿认真吃的饭、一段可靠的关系，都能带来踏实感。慢一点，并不等于没有在前进。"
    },
    "strength": {
      "title": "稳定、耐心、有质感",
      "body": "愿意持续投入，也留意细节是否舒服、耐用，能为周围的人带来踏实感。"
    },
    "blindspot": {
      "title": "熟悉不一定最合适",
      "body": "维护稳定时，可能对新方法保留太久。也可以给改变留一个小范围的入口。"
    },
    "career": {
      "title": "让专业经得起时间",
      "body": "有些价值，要等时间才能看见。需要耐心打磨、稳定交付、照顾体验的工作，更容易承接金牛式的投入。不必一味追赶别人的速度，也记得偶尔看看：熟悉的方法，还适合现在吗？",
      "scenes": [
        "长期项目",
        "质量打磨",
        "稳定协作"
      ]
    },
    "money": {
      "title": "重视价值，也舍得体验",
      "body": "愿意为品质与长久的安心付出，也重视手里留得住的东西。看见余额慢慢积累，和把生活照顾好，同样能带来满足。可以想想：哪笔花费让你长久受用，哪一笔只是为了维持熟悉？"
    },
    "traits": [
      {
        "style": "稳定托底",
        "body": "通过可靠的安排和持续兑现建立信任，让团队知道下一步有依靠，而不是只听见口号。"
      },
      {
        "style": "踏实陪伴",
        "body": "更习惯用耐心、照顾和实际行动表达在意，相处久了，往往更能感受到这份温度。"
      },
      {
        "style": "持续积累",
        "body": "一旦认可目标，愿意按节奏往前推进；定期回看方向，能避免只坚持已经习惯的做法。"
      },
      {
        "style": "质感打磨",
        "body": "常从触感、体验和细节中找到改进点，把熟悉的东西做得更舒服，也是一种创造。"
      }
    ]
  },
  "gemini": {
    "headline": "换个角度，\n总有新看法",
    "personality": {
      "title": "在交流中打开世界",
      "body": "和不同的人聊一聊，世界就多出几个入口。双子的常见解读里有好奇、机敏，也有不愿太早定型的心。兴趣多并不等于不认真；让一个想法有机会走得深一点，也会有新的惊喜。"
    },
    "strength": {
      "title": "反应灵活，善于连接",
      "body": "能把不同信息与人联系起来，让讨论多一个角度，也让陌生的话题更容易展开。"
    },
    "blindspot": {
      "title": "想法多，也要有落点",
      "body": "不断打开新窗口时，容易分散注意。选一条线索认真追到底，同样值得体验。"
    },
    "career": {
      "title": "把信息变成有用的连接",
      "body": "提问、连接信息、把复杂的事讲得有意思，都是双子式工作画像里的亮点。变化与交流能带来新鲜感。需要长期推进时，给自己留一个清楚的阶段成果，让灵活不只是“想到”，也能被看见。",
      "scenes": [
        "信息梳理",
        "跨团队沟通",
        "内容表达"
      ]
    },
    "money": {
      "title": "从信息里看见可能",
      "body": "新工具、新体验、新机会，都可能让人想试试看。好奇心能打开选择，也容易让花费变得零碎。回想最近买过的几样新东西：哪些真的进入生活，哪些只满足了“我想知道”的那一刻？"
    },
    "traits": [
      {
        "style": "沟通串联",
        "body": "擅长让信息流动，帮助不同的人理解彼此。把讨论收束成明确决定，会更有带领感。"
      },
      {
        "style": "轻松打开话题",
        "body": "用提问、幽默和共同兴趣消除陌生感；放慢一点听完对方，也能建立更深的连接。"
      },
      {
        "style": "灵活应变",
        "body": "遇到新情况能很快调整做法；把最重要的一件事写清楚，有助于避免频繁切换。"
      },
      {
        "style": "跨界联想",
        "body": "容易把两个不相干的线索接起来，产生新点子；选一个点子做成小样，会让想象更具体。"
      }
    ]
  },
  "cancer": {
    "headline": "把在意的人，\n放在心上",
    "personality": {
      "title": "细腻，也珍惜归属",
      "body": "很多在意，没有大声说出来，却都记在心里。巨蟹的常见解读把情感、照顾与归属感放在重要的位置。留意别人的需要是温柔；允许自己也需要被照顾，同样值得。"
    },
    "strength": {
      "title": "看得见细小的需要",
      "body": "能记住别人不经意提到的事，用具体照顾让关系慢慢变得安心。"
    },
    "blindspot": {
      "title": "照顾里也要有自己",
      "body": "感受到气氛变化，不等于知道对方的全部想法。把需要说出来，比独自猜测更清楚。"
    },
    "career": {
      "title": "让团队有安心协作的土壤",
      "body": "能察觉气氛、记得细节、让合作的人感到安心，是巨蟹式工作画像里容易被低估的价值。支持、服务与持续经营关系的场景可能更有共鸣。关心可以有边界，不必用“我全都接住”证明认真。",
      "scenes": [
        "团队支持",
        "用户服务",
        "长期维护"
      ]
    },
    "money": {
      "title": "金钱常与安全感相连",
      "body": "金钱常和“能不能安心照顾自己与家人”连在一起，也可能花在礼物、家与共同的体验上。可以回看一次为别人花的钱：那份心意里，有没有也给自己的需要留一点位置？"
    },
    "traits": [
      {
        "style": "照顾与凝聚",
        "body": "通过理解成员的处境建立凝聚力，让人愿意一起做事；明确要求也能和温柔同时存在。"
      },
      {
        "style": "细致体贴",
        "body": "容易注意到情绪和细小偏好，用具体照顾表达善意；也给别人直接说明需要的机会。"
      },
      {
        "style": "为在意的事坚持",
        "body": "当目标和重要的人、价值联系在一起时，投入更持久；同时留意自己的精力边界。"
      },
      {
        "style": "从记忆里生长",
        "body": "生活片段、情绪和熟悉的场景常带来灵感，能把细微感受转成有温度的表达。"
      }
    ]
  },
  "leo": {
    "headline": "发着光，\n也温暖别人",
    "personality": {
      "title": "希望表达，也愿意付出",
      "body": "想被认真看见，也愿意让身边的人一起发光。狮子的常见解读里，热情和自尊常常并肩出现。被认可会有力量；没有站在聚光灯下时，那份认真也依然有价值。"
    },
    "strength": {
      "title": "感染力与慷慨",
      "body": "愿意为重要的事站出来，也乐于把热情、机会和肯定分享给周围的人。"
    },
    "blindspot": {
      "title": "让认可不只来自外面",
      "body": "被忽略或否定时，可能很在意。留意自己的判断，也给不同的声音一点空间。"
    },
    "career": {
      "title": "在表达与担当中发挥",
      "body": "愿意站出来表达、承担责任、带动士气，是狮子式工作画像里鲜明的一面。需要展示与协作的场景可能更有发挥空间。把功劳也说给同伴听，让带领变成彼此愿意靠近的事。",
      "scenes": [
        "提案表达",
        "团队动员",
        "创意呈现"
      ]
    },
    "money": {
      "title": "愿意为喜欢与体面付出",
      "body": "愿意为喜欢的体验和体面的表达投入，也珍惜“我有能力给予”的感觉。一次慷慨之后，不妨看看：这份付出让自己舒展，还是在担心不够好看？真正喜欢的生活，也包括不勉强自己。"
    },
    "traits": [
      {
        "style": "愿景与鼓舞",
        "body": "用清楚的方向和热情带动团队，愿意承担公开表达的责任；分享舞台会让人更愿意跟随。"
      },
      {
        "style": "大方温暖",
        "body": "喜欢用肯定和热情让人感到被欢迎，也愿意为朋友付出；认真听见小声的意见同样重要。"
      },
      {
        "style": "目标驱动",
        "body": "当目标值得投入、成果能够被看见时，行动更有力量；也给不显眼的准备工作留足时间。"
      },
      {
        "style": "鲜明表达",
        "body": "愿意为作品加上自己的风格，让想法有辨识度；接纳反馈，可以让表达更打动人。"
      }
    ]
  },
  "virgo": {
    "headline": "把小事，\n做得更妥帖",
    "personality": {
      "title": "在细节里寻找清楚",
      "body": "别人觉得“差不多”的地方，你还想再照顾得妥帖一点。处女座的常见解读看重细节、秩序与实际的帮助。认真是可贵的；允许一件事先完成，也是在照顾自己的精力。"
    },
    "strength": {
      "title": "认真、具体、能改进",
      "body": "能把模糊的问题拆开，发现容易遗漏的细节，让想法更接近可操作的样子。"
    },
    "blindspot": {
      "title": "为足够好留一点空间",
      "body": "标准高时，可能把注意都放在不足上。已经完成的部分，也值得被看见。"
    },
    "career": {
      "title": "把复杂变得清楚可做",
      "body": "找出遗漏、理清流程、把交付做得更好，是处女座式工作画像里的踏实价值。质量要求清楚、反馈具体的任务，可能更能承接这份细心。开始前说好“做到哪里就够”，会让投入更从容。",
      "scenes": [
        "流程整理",
        "研究分析",
        "质量检查"
      ]
    },
    "money": {
      "title": "在细节里建立掌控感",
      "body": "花钱之前想比较、想弄清值不值得，是对生活负责的一种方式。也值得留意：为了选出“最合适”，是否花掉了太多时间与心力？回看一笔让你省心的支出，看看方便与品质对你意味着什么。"
    },
    "traits": [
      {
        "style": "专业与秩序",
        "body": "通过清楚的标准和具体帮助赢得信任，能指出下一步怎么做；肯定进展会让要求更容易被接受。"
      },
      {
        "style": "细节里的关心",
        "body": "常用解决问题、记住习惯表达在意；有时先听一听，比马上给出改进办法更能靠近对方。"
      },
      {
        "style": "拆解与落实",
        "body": "能把目标拆成可检查的小步骤，持续修正细节；明确完成边界，有助于按时收尾。"
      },
      {
        "style": "从问题中改良",
        "body": "创造常来自对现有做法的细致观察，把不顺手的地方调整好，能带来真实的体验变化。"
      }
    ]
  },
  "libra": {
    "headline": "不同声音里，\n找到分寸",
    "personality": {
      "title": "重视关系，也在寻找平衡",
      "body": "习惯先听听两边，也希望每个人都能舒服地表达。天秤的常见解读重视分寸、公平与相处的美感。体谅别人的同时，把自己的偏好说清楚，也能让关系更轻松。"
    },
    "strength": {
      "title": "看见不同，也善于协调",
      "body": "能为僵持的讨论找到共同点，让人感觉被尊重，也让合作多一点空间。"
    },
    "blindspot": {
      "title": "平衡里要有自己的位置",
      "body": "为了照顾气氛，可能延后真实意见。关系中的和谐，也需要清楚的立场。"
    },
    "career": {
      "title": "让协作与判断更有分寸",
      "body": "把不同意见放到一起，找到大家愿意继续合作的方式，是天秤式工作画像里的长处。沟通、协调与体验设计等场景可能更有共鸣。遇到需要决定的时刻，可以先确认最重要的两三个条件。",
      "scenes": [
        "合作沟通",
        "方案整合",
        "审美判断"
      ]
    },
    "money": {
      "title": "关系、品质与选择的分寸",
      "body": "喜欢有美感的东西，也愿意为好的相处体验买单。选择多时，比较会变得费心。想想最近一次满意的购买：让你满意的是自己的喜欢，还是别人觉得不错？这个区别，可能比选哪一件更有启发。"
    },
    "traits": [
      {
        "style": "协调与共识",
        "body": "愿意把不同意见带进讨论，找到可以一起推进的部分；关键时刻清楚表态，会让共识更有方向。"
      },
      {
        "style": "尊重与分寸",
        "body": "会留意谈话气氛，给人被尊重的感觉；适当表达不认同，也能建立更真实的亲近。"
      },
      {
        "style": "协作推进",
        "body": "在角色清楚、关系顺畅时更容易推进事情；给选择设一个截止点，可以减少反复权衡。"
      },
      {
        "style": "平衡与组合",
        "body": "擅长从比例、关系和不同元素的搭配中发现新方案，让表达兼顾美感与他人的理解。"
      }
    ]
  },
  "scorpio": {
    "headline": "认定之后，\n愿意走得更深",
    "personality": {
      "title": "专注，也重视真实与信任",
      "body": "没有轻易交出去的信任，一旦认定，就愿意认真到底。天蝎的常见解读强调深度、投入与清楚的界限。珍惜这份专注，也给尚未说清的事留一点询问的空间。"
    },
    "strength": {
      "title": "深入、专注、有韧性",
      "body": "愿意把关键问题追到底，在复杂或需要持续投入的事情上保有耐心。"
    },
    "blindspot": {
      "title": "给信任留出呼吸感",
      "body": "想看清一切时，容易把猜测抓得太紧。核对事实、说出需要，也能带来安全感。"
    },
    "career": {
      "title": "愿意把关键问题挖深",
      "body": "愿意追到问题深处，长时间守住一个重要目标，是天蝎式工作画像里的韧性。研究、复杂问题处理与需要保密边界的协作，可能更有共鸣。不必独自把所有事想透，适时交换信息也能让判断更稳。",
      "scenes": [
        "深入研究",
        "复杂问题",
        "长期攻坚"
      ]
    },
    "money": {
      "title": "重视资源背后的掌控感",
      "body": "重视资源的掌握与安全感，不喜欢重要的事全凭别人安排。投入之前想看清底层原因，也可能不愿轻易透露自己的计划。回看一次重要的金钱选择：你希望获得的，是东西本身，还是多一点自主？"
    },
    "traits": [
      {
        "style": "聚焦关键",
        "body": "愿意抓住核心问题持续推进，在困难面前保持投入；让判断过程更透明，可以增加团队信任。"
      },
      {
        "style": "深度信任",
        "body": "亲近往往建立在真实和可靠的互动上，未必热闹却很认真；也允许关系一步步建立。"
      },
      {
        "style": "专注攻坚",
        "body": "对认定的事有持续推进的韧性；适时交换反馈，可以避免独自承担太久或在一条路上耗尽精力。"
      },
      {
        "style": "洞察与重组",
        "body": "喜欢追问表面之外的原因，从隐含联系中提出新的解释；用事实检验，会让洞察更扎实。"
      }
    ]
  },
  "sagittarius": {
    "headline": "向着有意思的\n地方出发",
    "personality": {
      "title": "需要探索，也看重意义",
      "body": "想看看更远的地方，也想知道生活还能怎样展开。射手的常见解读珍惜自由、坦率与新的体验。热爱可能是很好的动力；愿意为喜欢的事留一点持续，也是一种自由。"
    },
    "strength": {
      "title": "开阔、乐观、愿意探索",
      "body": "能把眼光放远，为眼前的难题带来新的可能，也愿意鼓励别人走出去看看。"
    },
    "blindspot": {
      "title": "让远方接上眼前的一步",
      "body": "热情跟着新方向移动时，细节可能被落下。说过的承诺，也需要具体的安排。"
    },
    "career": {
      "title": "在探索中拓宽边界",
      "body": "学习新领域、把经验讲给别人、在变化中寻找方向，是射手式工作画像里常见的热情。需要探索与表达的任务可能更有共鸣。宏大的方向之外，留一个这周能完成的小成果，让期待有落点。",
      "scenes": [
        "领域探索",
        "知识传播",
        "跨文化交流"
      ]
    },
    "money": {
      "title": "愿意为体验与成长花钱",
      "body": "比起只拥有一件东西，旅行、学习与新体验可能更让人心动。愿意为视野付出，也值得分清哪些体验留下了长久的价值。回想一次花得开心的钱：它拓宽了生活，还是只是暂时逃离了当下？"
    },
    "traits": [
      {
        "style": "方向与激励",
        "body": "擅长讲清值得奔赴的方向，让团队看到更大的可能；把愿景拆成近期安排，会更容易同行。"
      },
      {
        "style": "坦率开阔",
        "body": "容易用轻松、真诚的交流拉近距离，愿意接纳不同背景；表达直接时，也留意对方的感受。"
      },
      {
        "style": "由兴趣启动",
        "body": "有意义的新目标会带来很强的启动意愿；固定一个收尾动作，能让探索留下更完整的成果。"
      },
      {
        "style": "拓宽视野",
        "body": "灵感常来自不同文化、经验和知识的碰撞，把外面的新见闻转成眼前可用的办法。"
      }
    ]
  },
  "capricorn": {
    "headline": "一步一步，\n把理想落在地上",
    "personality": {
      "title": "认真，也愿意为目标负责",
      "body": "很多努力不在嘴上，而在每天照常做的事情里。摩羯的常见解读重视责任、积累与可以兑现的结果。可靠是一份长处；偶尔停下来，也不会让已经走过的路失去意义。"
    },
    "strength": {
      "title": "有耐心，也愿意承担",
      "body": "能把远处的目标拆成阶段，持续兑现承诺，在不容易的时候仍愿意往前走。"
    },
    "blindspot": {
      "title": "责任不必全靠自己扛",
      "body": "当要求变成习惯，容易忘记休息与求助。自己的价值，也不只来自完成了多少事。"
    },
    "career": {
      "title": "让长期目标有清楚的台阶",
      "body": "把长远目标拆成步骤，愿意为结果持续投入，是摩羯式工作画像里让人安心的部分。需要规划与长期跟进的任务可能更有共鸣。别只在完成时才允许自己满意，中途的进展也值得被看见。",
      "scenes": [
        "长期规划",
        "资源协调",
        "阶段交付"
      ]
    },
    "money": {
      "title": "看重积累与资源的用途",
      "body": "常把钱看作选择权、责任与长期生活的支撑，愿意为了重要目标耐心积累。也可以留意自己是否总把满足推到“以后”。一笔照顾当下需要的花费，未必是在偏离长期计划。"
    },
    "traits": [
      {
        "style": "目标与担当",
        "body": "愿意承担责任、明确标准，让团队看见目标和路径；让成员参与判断，可以减少独自扛事。"
      },
      {
        "style": "可靠而克制",
        "body": "往往通过兑现承诺和实际帮助表达在意；多说一句认可，能让别人更容易感受到这份关心。"
      },
      {
        "style": "长期推进",
        "body": "能够接受缓慢积累，按阶段持续往前走；定期检查方向，也让坚持与调整同时发生。"
      },
      {
        "style": "结构中的突破",
        "body": "喜欢让新点子变成能运转的方案，在资源与条件之内找到更可持续、更容易落实的做法。"
      }
    ]
  },
  "aquarius": {
    "headline": "熟悉的世界，\n也能有新想法",
    "personality": {
      "title": "独立，也关心更大的可能",
      "body": "熟悉的规则之外，总想问一句“还有别的办法吗”。水瓶的常见解读珍惜独立、想法与平等的相处。与众不同可以是一份礼物，也不必让自己每一次都站在远处。"
    },
    "strength": {
      "title": "独立思考，敢换角度",
      "body": "能从默认做法之外提出问题，让熟悉的事情出现新的解释与选择。"
    },
    "blindspot": {
      "title": "想法也需要被人理解",
      "body": "站得远能看清结构，也可能忽略眼前的感受。把抽象观点说得具体一些，更容易靠近别人。"
    },
    "career": {
      "title": "为旧问题试一个新框架",
      "body": "重新定义问题、连接不同领域、给旧流程一个新方案，是水瓶式工作画像里的可能。容得下讨论和试验的环境，往往更能承接这份思考。先让别人看懂想法要解决什么，创新就更容易一起发生。",
      "scenes": [
        "系统思考",
        "新方案试验",
        "跨领域合作"
      ]
    },
    "money": {
      "title": "把资源和新的可能联系起来",
      "body": "可能愿意为新技术、理念或不一样的生活方式投入，也希望金钱选择有自己的理由。回看一笔“别人不太理解，但我想试试”的花费：它真的贴近需要，还是只是让自己感到与众不同？"
    },
    "traits": [
      {
        "style": "愿景与自主",
        "body": "愿意提出不同的方向，也给成员独立尝试的空间；用具体沟通连接愿景与日常，会更有凝聚力。"
      },
      {
        "style": "平等与尊重",
        "body": "乐于接纳不同的人和想法，珍惜彼此的独立；表达关心时，具体回应比只有道理更有温度。"
      },
      {
        "style": "方法驱动",
        "body": "找到认同的方法或系统后，推进会更顺畅；也留意真实使用中的阻力，允许方案不断调整。"
      },
      {
        "style": "突破惯例",
        "body": "容易从规则之外提出新问题，把不同领域的想法重新组合；小范围验证有助于看见它的实际作用。"
      }
    ]
  },
  "pisces": {
    "headline": "让感受，\n有自己的形状",
    "personality": {
      "title": "敏锐，也有丰富的想象",
      "body": "一首歌、一句话，或别人没说出口的难处，都可能在心里停留很久。双鱼的常见解读把感受、想象与共情放在前面。这份柔软值得珍惜，也值得有清楚的边界来保护。"
    },
    "strength": {
      "title": "理解感受，善于想象",
      "body": "能为难以表达的情绪找到语言，也能在故事、图像和体验之间建立柔软的联系。"
    },
    "blindspot": {
      "title": "柔软里也需要边界",
      "body": "接住别人的情绪时，也留意自己的精力。愿望可以很美，下一步仍需要足够具体。"
    },
    "career": {
      "title": "让感受成为可以分享的表达",
      "body": "把感受变成故事、作品或细致的回应，是双鱼式工作画像里容易动人的部分。创作、表达与需要理解人的场景可能更有共鸣。灵感来时，先留下一个小草稿；没有灵感时，也给自己一个能开始的步骤。",
      "scenes": [
        "创作表达",
        "体验设计",
        "理解人的需要"
      ]
    },
    "money": {
      "title": "消费里常有情绪与理想",
      "body": "喜欢有故事、有情感意义的东西，也可能因为心软而多付出一点。善意很珍贵，却不需要每次都由花钱来证明。回看一笔带着情绪的支出：当时真正想被照顾的，是哪一种感受？"
    },
    "traits": [
      {
        "style": "感受与包容",
        "body": "能够理解不同成员的情绪，让人感到被接纳；用清楚的目标和边界承接关怀，团队会更有方向。"
      },
      {
        "style": "共情与倾听",
        "body": "愿意听见别人不容易说出口的部分，以柔和的方式回应；也留意哪些情绪不需要全部由自己承担。"
      },
      {
        "style": "由意义落地",
        "body": "和价值、感受相连的目标更能带动投入；把第一步写得很具体，有助于让想象进入日常。"
      },
      {
        "style": "想象与表达",
        "body": "灵感可能来自音乐、画面和生活中的微小触动，擅长把感受转成有感染力的故事或作品。"
      }
    ]
  }
};
  const signs = [
    { id:'aries', name:'白羊座', latin:'Aries', family:'火象', tone:'fire', words:['主动','直接','热情'], question:'今天有哪一刻，你想先迈出第一步？', note:'也留意一下：行动之前，你给自己留了多少准备和调整的空间？' },
    { id:'taurus', name:'金牛座', latin:'Taurus', family:'土象', tone:'earth', words:['稳定','耐心','感受'], question:'今天，什么让你感觉踏实、舒服？', note:'可能是一顿认真吃的饭，也可能是一个熟悉的节奏。把那个片刻留下来。' },
    { id:'gemini', name:'双子座', latin:'Gemini', family:'风象', tone:'air', words:['好奇','交流','变化'], question:'今天哪一次交流，带给你一个新想法？', note:'不用急着下结论，先记下你想继续了解的那一点。' },
    { id:'cancer', name:'巨蟹座', latin:'Cancer', family:'水象', tone:'water', words:['照顾','安全感','情感'], question:'今天，你在哪个人或地方身边更放松？', note:'留意那份安心来自什么，也看看自己的需要有没有被照顾到。' },
    { id:'leo', name:'狮子座', latin:'Leo', family:'火象', tone:'fire', words:['表达','创造','认可'], question:'今天，有什么让你想认真表达自己？', note:'可以是一句话、一个作品，或一次你希望被看见的努力。' },
    { id:'virgo', name:'处女座', latin:'Virgo', family:'土象', tone:'earth', words:['细节','秩序','完善'], question:'今天，你让哪件小事变得更清楚了？', note:'也可以问问自己：哪些地方已经足够好，可以先放一放？' },
    { id:'libra', name:'天秤座', latin:'Libra', family:'风象', tone:'air', words:['平衡','协作','选择'], question:'今天的一次选择里，你最在意什么？', note:'把自己的想法和别人的期待分开写一写，看看它们分别占了多少位置。' },
    { id:'scorpio', name:'天蝎座', latin:'Scorpio', family:'水象', tone:'water', words:['专注','信任','深度'], question:'今天，哪件事让你愿意认真投入？', note:'记下投入时的感受，也留意什么时候需要停下来、给自己一点空间。' },
    { id:'sagittarius', name:'射手座', latin:'Sagittarius', family:'火象', tone:'fire', words:['自由','探索','新鲜感'], question:'今天，你遇见了什么没试过的可能？', note:'不必是很远的地方，一个新问题或一次小尝试也算。' },
    { id:'capricorn', name:'摩羯座', latin:'Capricorn', family:'土象', tone:'earth', words:['目标','坚持','责任'], question:'今天，你为在意的事往前走了哪一小步？', note:'也记得看看：你承担的事情里，哪些是自己愿意选择的？' },
    { id:'aquarius', name:'水瓶座', latin:'Aquarius', family:'风象', tone:'air', words:['独立','想象','新视角'], question:'今天，你有没有从不同的角度看一件事？', note:'把那个与平时不同的念头留下来，暂时不必证明它对或错。' },
    { id:'pisces', name:'双鱼座', latin:'Pisces', family:'水象', tone:'water', words:['共情','直觉','想象'], question:'今天，哪个细节轻轻触动了你？', note:'可以写一种感受、一幅画面，也可以分辨一下哪些情绪属于自己。' }
  ].map(sign => ({ ...sign, ...profiles[sign.id], traits: profiles[sign.id].traits.map((trait,index) => ({ ...traitMeta[index], ...trait })) }));
  const glyphs = {
    aries:'<path d="M50 82V47C50 19 20 12 20 35c0 18 19 20 19 4M50 47c0-28 30-35 30-12 0 18-19 20-19 4"/>',
    taurus:'<circle cx="50" cy="59" r="23"/><path d="M23 18c2 23 52 23 54 0"/>',
    gemini:'<path d="M29 19q21 9 42 0M29 81q21-9 42 0M36 23v54M64 23v54"/><circle cx="36" cy="42" r="8"/><circle cx="64" cy="42" r="8"/>',
    cancer:'<circle cx="33" cy="36" r="12"/><circle cx="67" cy="65" r="12"/><path d="M22 42c11-27 44-28 58-10M78 59C67 86 34 87 20 69"/>',
    leo:'<circle cx="29" cy="67" r="13"/><path d="M40 61C59 45 30 34 43 20c18-18 42 0 28 24-12 20-5 39 16 26"/>',
    virgo:'<path d="M19 70V32c0-20 19-20 19 0v38-38c0-20 19-20 19 0v38-33c0-20 22-16 22 1 0 18-18 32-25 43M58 45q23 1 24 31"/>',
    libra:'<path d="M50 20v60M27 33h46M17 80h66M27 33 12 62h30Zm46 0L58 62h30Z"/><path d="M12 62q15 17 30 0M58 62q15 17 30 0"/>',
    scorpio:'<path d="M18 70V31c0-19 18-19 18 0v39-39c0-19 18-19 18 0v34c0 17 23 21 31-1M73 64l13-7 3 14"/>',
    sagittarius:'<path d="m23 78 54-54M48 24h29v29M25 45l30 30"/><path d="M20 23q3 38 57 57" opacity=".45"/>',
    capricorn:'<path d="M18 31v36M18 45c11-29 25-26 25-1v15c0 24 39 22 39-1 0-22-26-20-24 0 1 18 27 22 31 8M43 51l13-21"/>',
    aquarius:'<path d="m13 37 15-12 15 12 15-12 15 12 14-12M13 67l15-12 15 12 15-12 15 12 14-12"/>',
    pisces:'<path d="M22 18q38 32 0 64M78 18q-38 32 0 64M22 50h56"/><circle cx="50" cy="50" r="5"/>'
  };
  const current = () => state.zodiac || (state.zodiac = { id:'aries', viewed:false, selectorOpen:false });
  const selected = () => signs.find(sign => sign.id === current().id) || signs[0];
  globalThis.zodiacArt = id => `<svg class="zodiac-glyph" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${glyphs[id] || glyphs.aries}</g></svg>`;
  const sectionPaths = {
    personality:'<path d="M8 20v-3a6 6 0 1 1 8-5v3h-3v5M10 7h.01M6 20h10"/>',
    career:'<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V4h8v3M3 12q9 6 18 0M10 13h4v3h-4Z"/>',
    money:'<circle cx="11" cy="14" r="7"/><path d="M11 10v8M9 11h3.5a1.5 1.5 0 0 1 0 3H10a1.5 1.5 0 0 0 0 3h3M15 7c0-4 3-5 6-5 0 4-2 7-6 5Z"/>',
    leadership:'<circle cx="12" cy="8" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3M3 13a3 3 0 0 1 3-3M21 13a3 3 0 0 0-3-3M12 1v1"/>',
    affinity:'<path d="M12 20S2 14 3 8c1-5 7-5 9-1 2-4 8-4 9 1 1 6-9 12-9 12Z"/>',
    execution:'<path d="M7 4h12v16H5V7M3 5l2 2 4-5M9 12l2 2 5-6M9 17h6"/>',
    creativity:'<path d="m12 2 2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5ZM20 17v5M18 19.5h4"/>'
  };
  globalThis.zodiacIcon = kind => `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${sectionPaths[kind] || sectionPaths.personality}</g></svg>`;
  globalThis.zodiacPortrait = id => {
    const sign=signs.find(item=>item.id===id)||signs[0],wash={fire:'#fbe9df',earth:'#e2f3ed',air:'#e8eeff',water:'#eee5fa'}[sign.tone];
    const motif={fire:'<path d="M184 32v14m-7-7h14M34 139l7 7 7-7"/>',earth:'<path d="M182 41q-3-23 18-24-1 20-18 24Zm0 0v19M34 137q11-15 20 0-10 13-20 0Z"/>',air:'<path d="M166 35h25q15 0 9-11-6-9-12 0M29 143h24q12 0 10-8"/>',water:'<path d="M164 35q9-10 18 0t18 0M29 142q8-9 16 0t16 0"/>'}[sign.tone];
    return `<svg class="zodiac-portrait" viewBox="0 0 230 190" aria-hidden="true"><path d="M57 34Q118 1 173 42t7 96q-55 44-115 5T57 34Z" fill="white" opacity=".83"/><circle cx="119" cy="96" r="65" fill="${wash}"/><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".65">${motif}<path d="m40 63 13-10 12 8m99 73 17 8 10-10"/><circle cx="40" cy="63" r="2.5"/><circle cx="65" cy="61" r="2"/><circle cx="164" cy="134" r="2.5"/></g><g transform="translate(70 47)" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">${glyphs[id] || glyphs.aries}</g><path d="m186 78 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#ddb184"/><path d="M73 164q45 13 89-1" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".28"/></svg>`;
  };
  globalThis.zodiacHomeSnapshot = () => ({ ...selected(), viewed:current().viewed });
  function hero(sign) {
    return `<div class="zodiac-profile-copy"><h2>${sign.name}</h2><p class="zodiac-profile-meta">${sign.latin} / ${sign.family}</p><p class="zodiac-profile-headline">${sign.headline}</p><div class="zodiac-profile-words">${sign.words.map(word=>`<span>${word}</span>`).join('')}</div></div>${zodiacPortrait(sign.id)}`;
  }
  function detail(sign) {
    return `<article class="zodiac-personality"><div class="zodiac-chapter-label">${zodiacIcon('personality')}<h3>性格</h3></div><h4>${sign.personality.title}</h4><p class="zodiac-reading-copy">${sign.personality.body}</p><div class="zodiac-character-sides"><section><h5>容易看见的优点</h5><strong>${sign.strength.title}</strong><p>${sign.strength.body}</p></section><section><h5>值得留意的一面</h5><strong>${sign.blindspot.title}</strong><p>${sign.blindspot.body}</p></section></div></article><div class="zodiac-topics"><article class="zodiac-topic zodiac-topic-career"><div class="zodiac-chapter-label">${zodiacIcon('career')}<h3>事业</h3></div><h4>${sign.career.title}</h4><p class="zodiac-reading-copy">${sign.career.body}</p><div class="zodiac-scenes">${sign.career.scenes.map(scene=>`<span>${scene}</span>`).join('')}</div></article><article class="zodiac-topic zodiac-topic-money"><div class="zodiac-chapter-label">${zodiacIcon('money')}<h3>财运与金钱观</h3></div><h4>${sign.money.title}</h4><p class="zodiac-reading-copy">${sign.money.body}</p></article></div><section class="zodiac-traits"><header><h3>四项特质</h3><p>看看带领、相处、行动与创造的方式。</p></header><div class="zodiac-traits-grid">${sign.traits.map(trait=>`<article class="zodiac-trait" data-zodiac-trait="${trait.id}"><div class="zodiac-trait-label">${zodiacIcon(trait.id)}<h4>${trait.label}</h4></div><p class="zodiac-trait-meaning">${trait.meaning}</p><h5>${trait.style}</h5><p class="zodiac-trait-copy">${trait.body}</p></article>`).join('')}</div></section><section class="zodiac-awareness"><h3>写下你的共鸣</h3><p class="zodiac-question">${sign.question}</p><p class="zodiac-observation">${sign.note}</p><button type="button" class="primary" data-zodiac-action="write">带着这个问题写日记</button></section>`;
  }
  function selector(sign) {
    return `<div class="zodiac-selector" id="zodiac-selector" ${current().selectorOpen?'':'hidden'}><div class="zodiac-orbit" role="radiogroup" aria-label="选择一个星座">${signs.map((item,index)=>{const angle=index*Math.PI/6;return `<button type="button" class="zodiac-choice zodiac-tone-${item.tone}" role="radio" data-zodiac-select="${item.id}" aria-checked="${item.id===sign.id}" tabindex="${item.id===sign.id?0:-1}" aria-label="${item.name}" style="left:${50+Math.sin(angle)*37}%;top:${50-Math.cos(angle)*37}%">${zodiacArt(item.id)}<span>${item.name}</span></button>`;}).join('')}<div class="zodiac-orbit-center" aria-hidden="true">${zodiacArt(sign.id)}<strong>${sign.name}</strong><span>${sign.latin}</span></div></div></div>`;
  }
  renderers.zodiac = () => {
    const sign=selected();current().viewed=true;
    const url=new URL(location.href);url.searchParams.set('sign',sign.id);history.replaceState(history.state,'',url);
    return `<section class="zodiac-page zodiac-tone-${sign.tone}">${head('12 星座图鉴','home','自我探索')}<div class="zodiac-reading-top"><p>性格、事业、金钱与相处方式</p><button type="button" id="zodiac-picker" data-zodiac-action="picker" aria-expanded="${!!current().selectorOpen}" aria-controls="zodiac-selector">切换星座 ${icon('next')}</button></div>${selector(sign)}<div class="zodiac-profile-deck" data-zodiac-swipe><div class="zodiac-profile-card" id="zodiac-hero">${hero(sign)}</div></div><nav class="zodiac-navigation" aria-label="浏览十二星座"><button type="button" data-zodiac-action="previous" aria-label="上一个星座">${icon('back')}</button><span id="zodiac-position">${signs.indexOf(sign)+1} / 12</span><button type="button" data-zodiac-action="next" aria-label="下一个星座">${icon('next')}</button></nav><p class="zodiac-selection-status" role="status" aria-live="polite" aria-atomic="true">正在看 ${sign.name}</p><div id="zodiac-detail">${detail(sign)}</div><p class="zodiac-footnote">星座文化的常见解读，供生活观察。个人表现以真实经历为准。</p></section>`;
  };
  function choose(id,focus=false) {
    const sign=signs.find(item=>item.id===id);if(!sign)return;
    current().id=id;current().viewed=true;if(!focus)current().selectorOpen=false;
    $('.zodiac-page').className=`zodiac-page zodiac-tone-${sign.tone}`;
    $('#zodiac-selector').hidden=!current().selectorOpen;$('#zodiac-picker').setAttribute('aria-expanded',String(!!current().selectorOpen));
    document.querySelectorAll('[data-zodiac-select]').forEach(button=>{const active=button.dataset.zodiacSelect===id;button.setAttribute('aria-checked',String(active));button.tabIndex=active?0:-1;if(active&&focus)button.focus({preventScroll:true});});
    $('.zodiac-orbit-center').innerHTML=`${zodiacArt(id)}<strong>${sign.name}</strong><span>${sign.latin}</span>`;
    $('#zodiac-hero').innerHTML=hero(sign);$('#zodiac-detail').innerHTML=detail(sign);$('#zodiac-position').textContent=`${signs.indexOf(sign)+1} / 12`;$('.zodiac-selection-status').textContent=`正在看 ${sign.name}`;
    const url=new URL(location.href);url.searchParams.set('sign',id);history.replaceState(history.state,'',url);
    $('#state-panel').textContent=zodiacReviewState();
  }
  const step = amount => choose(signs[(signs.indexOf(selected())+amount+12)%12].id);
  document.addEventListener('click',event=>{
    if(page!=='zodiac')return;
    const choice=event.target.closest('[data-zodiac-select]');
    if(choice){event.preventDefault();event.stopImmediatePropagation();choose(choice.dataset.zodiacSelect);$('#zodiac-picker').focus({preventScroll:true});return;}
    const button=event.target.closest('[data-zodiac-action]');if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();const action=button.dataset.zodiacAction;
    if(action==='picker'){current().selectorOpen=!current().selectorOpen;$('#zodiac-selector').hidden=!current().selectorOpen;button.setAttribute('aria-expanded',String(current().selectorOpen));}
    else if(action==='previous'||action==='next')step(action==='next'?1:-1);
    else if(action==='write'){const sign=selected();openDiaryFromHome({prompt:{source:`星座图鉴 · ${sign.name}`,question:sign.question}});}
  },true);
  document.addEventListener('keydown',event=>{
    if(page!=='zodiac'||!event.target.closest('.zodiac-page'))return;
    const choice=event.target.closest('[data-zodiac-select]');
    if(choice&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)){
      event.preventDefault();event.stopImmediatePropagation();const index=signs.indexOf(selected());
      choose(signs[event.key==='Home'?0:event.key==='End'?11:(index+(['ArrowRight','ArrowDown'].includes(event.key)?1:11))%12].id,true);return;
    }
    if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();step(event.key==='ArrowRight'?1:-1);}
    else if(event.key==='Escape'&&current().selectorOpen){current().selectorOpen=false;$('#zodiac-selector').hidden=true;$('#zodiac-picker').setAttribute('aria-expanded','false');$('#zodiac-picker').focus();}
  },true);
  let swipeStart=null;
  document.addEventListener('pointerdown',event=>{if(page==='zodiac'&&event.target.closest('[data-zodiac-swipe]')&&!event.target.closest('button'))swipeStart={x:event.clientX,y:event.clientY,id:event.pointerId};});
  document.addEventListener('pointerup',event=>{const start=swipeStart;swipeStart=null;if(page!=='zodiac'||!start||event.pointerId!==start.id)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dx)>44&&Math.abs(dx)>Math.abs(dy)*1.5)step(dx<0?1:-1);});
  document.addEventListener('pointercancel',()=>{swipeStart=null;});
  pageMeta.push(['zodiac','12 星座图鉴','自我探索','阅读十二星座的性格、事业、金钱观与四项特质，再留下一次自己的觉察。',['十二个星座均有完整卡片，可左右浏览或展开星盘切换。','所有特质解释默认展示，不用能力分数，不代填日记正文。']]);
  reviewGroups.find(group=>group.id==='home').pages.push('zodiac');reviewLabels.zodiac='12 星座图鉴';
  globalThis.zodiacReviewState=()=>{
    $('#scenarios').innerHTML=goButton('回到首页','home','scenario')+goButton('觉察日记','diary','scenario');
    return `星座档案：${selected().name}\n内容：性格、事业、财运与金钱观，四项特质解释\n特质：领导力、亲和力、执行力、创造力\n能力分数：未设置\n日记只带观察问题，正文保留本人输入`;
  };
  const requested=new URLSearchParams(location.search).get('sign');if(signs.some(sign=>sign.id===requested))current().id=requested;
})();
