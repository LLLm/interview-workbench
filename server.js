const express = require("express");
const cors = require("cors");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3099;
const DATABASE_URL = process.env.DATABASE_URL;
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || "interview2026";

if (!DATABASE_URL) {
  console.error("DATABASE_URL not set. Add it in Render Environment.");
  process.exit(1);
}
if (!process.env.ACCESS_PASSWORD) {
  console.warn("⚠️  ACCESS_PASSWORD not set, using default. Set it in Render Environment!");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Simple session store: token -> expiry (30 days)
const sessions = new Map();

app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  if (password === ACCESS_PASSWORD) {
    const token = uuidv4();
    sessions.set(token, Date.now() + 30 * 24 * 60 * 60 * 1000);
    res.json({ token });
  } else {
    res.status(401).json({ error: "密码错误" });
  }
});

// Protect all /api routes except /login
app.use("/api", (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.replace("Bearer ", "").trim();
  const expiry = sessions.get(token);
  if (token && expiry && expiry > Date.now()) {
    return next();
  }
  res.status(401).json({ error: "unauthorized" });
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      icon TEXT DEFAULT '📄',
      sort_order INTEGER DEFAULT 0,
      "resumeData" TEXT
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      "moduleId" TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      scenes TEXT DEFAULT '[]',
      "dataTags" TEXT DEFAULT '[]',
      sections TEXT DEFAULT '[]',
      sort_order INTEGER DEFAULT 0
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cards_module ON cards("moduleId");`);

  const count = await pool.query(`SELECT COUNT(*) as c FROM modules`);
  if (parseInt(count.rows[0].c) === 0) {
    await seed();
  }
  console.log("db ready");
}

async function seed() {
  const mods = [
    ["intro","自我介绍","不同场景下的版本，按需调用","🧑",0,null],
    ["exp","经历","每段经历的结构化弹药","📋",1,null],
    ["skill","能力技能","跨经历封装的核心能力","⚡",2,null],
    ["qa","问答弹药","按题型组织的高频问答","💬",3,null],
    ["phrase","常用话术","跨模块通用的骨架句","📝",4,null],
    ["resume","个人简历","可编辑修改","📄",5,'{"name":"胡佳其","phone":"13135333569","email":"jackiehu0300@163.com","age":"22岁","location":"深圳","intent":"市场活动策划 / 活动运营","education":"湘潭理工学院 · 计算机科学与技术 · 本科","core":"执行落地·技术提效·内容赋能"}'],
    ["company","公司准备","面试前调研与弹药组合","🏢",6,null]
  ];
  for (const m of mods) {
    await pool.query(`INSERT INTO modules (id,title,description,icon,sort_order,"resumeData") VALUES ($1,$2,$3,$4,$5,$6)`, m);
  }

  const cards = [
    ["c01","intro","90秒标准版","正式面试 · 视频/现场","polished",'["正式面试"]','["10+场活动"]','[{"label":"话术","quote":"我叫胡佳其，22岁，计算机专业本科。核心能力：执行落地——独立操盘10+场千人级活动，从搭建到控场零事故交付；技术提效——计算机+AI做活动数据复盘；内容赋能——让活动不只做完还有沉淀。"}]',0],
    ["c02","intro","30秒简短版","HR电话突袭","polished",'["电话面试"]','[]','[{"label":"话术","quote":"我是胡佳其，22岁，计算机专业本科。10+场千人级活动独立操盘零事故。"}]',1],
    ["c03","intro","校招/双选会版","待补充","draft",'["校招"]','[]','[{"label":"待补充","quote":""}]',2],
    ["c04","exp","残疾人岗位能手职业技能竞赛","赛事统筹 · 2024.07-08 · 200人","polished",'["最有成就感的事","复杂现场"]','["零事故+35%"]','[{"label":"一句话定义","quote":"全省200名三类残障选手，三套差异化动线，零事故效率提升35%。"},{"label":"核心判断","quote":"体验取决于引导颗粒度而非统一标准。"},{"label":"行动结果","quote":"推翻统一模板，完成10工位无障碍改造。"},{"label":"钩子","quote":"活动现场的体验不是流程决定的，是细节密度决定的。"}]',0],
    ["c05","exp","中车株机亲子无人机研学","项目负责人 · 2024.06 · 1300人/7场","polished",'["现场应变"]','["零事故"]','[{"label":"一句话定义","quote":"从商务提案到7场1300人活动独立交付。"},{"label":"核心判断","quote":"同时回应中车5个部门关切。"},{"label":"行动结果","quote":"无人机撒糖险情→3秒判断转化。"},{"label":"钩子","quote":"现场控场靠判断下一幕的速度。"}]',1],
    ["c06","exp","通航博览会/翼择无人机","营销策划 · 2024.06-10 · 1000+B端","polished",'["供应商管理"]','["建联12%"]','[{"label":"一句话定义","quote":"零资源起步1.5月触达1000+B端。"},{"label":"核心判断","quote":"B2B展会定位为品牌渗透。"},{"label":"行动结果","quote":"搜20家→筛3家→独立完成全线物料。建联率12%。"},{"label":"钩子","quote":"没有资源时搜索能力就是最大的资源。"}]',2],
    ["c07","exp","职教城青年歌手大赛","选手管理 · 2024.10 · 300人/9校","polished",'["UGC传播"]','["触达5000+"]','[{"label":"一句话定义","quote":"9校300选手主动发起UGC传播战役。"},{"label":"核心判断","quote":"让选手自己做传播节点。"},{"label":"行动结果","quote":"统一宣传卡+社群扩散+投票。触达5000人。"},{"label":"钩子","quote":"真正有传播力的是让参与者自己愿意传播。"}]',3],
    ["c08","exp","PPT定制副业","小红书 · 20-40单","draft",'["商业思维"]','["转化70%"]','[{"label":"一句话定义","quote":"小红书PPT定制，服务爱奇艺悬疑短剧。"},{"label":"核心判断","quote":"客户需要理解业务逻辑的人。"},{"label":"行动结果","quote":"70%自素材，50-100元/页，转化率70%。"},{"label":"钩子","quote":"输出前想清楚受众要什么决策。"}]',4],
    ["c09","skill","AI+数据工作流","差异化优势","polished",'["你为什么与众不同"]','[]','[{"label":"话术","quote":"别人靠经验，我做活动靠数据+AI+SOP。"}]',0],
    ["c10","skill","供应商管理","从零起步","polished",'["供应商怎么找"]','[]','[{"label":"话术","quote":"选供应商不是比价格，是确认对方理解你的底线。"}]',1],
    ["c11","skill","内容策略与创作","34篇推文","polished",'["内容运营"]','[]','[{"label":"话术","quote":"内容运营是想清楚谁在看、他为什么看、看完能做什么。"}]',2],
    ["c12","qa","为什么从计算机转行做活动？","动机类","polished",'["动机类"]','[]','[{"label":"回答","quote":"不是转行是交叉优势。计算机给我结构化思维和数据习惯。"}]',0],
    ["c13","qa","你对我们了解多少？","公司类","polished",'["公司类"]','["考前必练"]','[{"label":"三层框架","quote":"一层定位+产品+动态。二层竞品+反馈。三层岗位+部门+问题。"}]',1],
    ["c14","qa","薪资谈判","压力类","polished",'["压力类"]','["血泪教训"]','[{"label":"回答","quote":"8K是我对岗位的合理预期。愿综合了解后确认。绝不主动降价。"}]',2],
    ["c15","qa","你考过研？为什么不再考了？","动机类","draft",'["动机类"]','[]','[{"label":"回答","quote":"专业课考前5%，英语差14分。主动选择，没有遗憾。不说天赋70%。"}]',3],
    ["c16","qa","你有什么问题想问我们？","展望类","draft",'["展望类"]','[]','[{"label":"三个问题","quote":"1.岗位最大挑战？2.团队配置？3.最近动向？"}]',4],
    ["c17","qa","说说你最有成就感的一件事","经历类","draft",'["经历类"]','[]','[{"label":"提示","quote":"调用经历模块——推荐残疾人竞赛。"}]',5],
    ["c18","phrase","过渡拉回句","话题跑偏时拉回来","polished",'["被带跑"]','[]','[{"label":"模板","quote":"用框架搭结构+用XX做验证的思路迁移到了活动策划上。"}]',0],
    ["c19","phrase","举证启动句","从我觉得到我做过","polished",'["替代我喜欢"]','[]','[{"label":"替换","quote":"我非常喜欢→我可以用一个经历来说明"}]',1],
    ["c20","phrase","压力回应句","被质疑时的标准启动","polished",'["被质疑","薪资"]','[]','[{"label":"模板","quote":"底层逻辑相通——供应商管理、动线设计、风险预判。"}]',2],
    ["c21","phrase","结束收束句","回答完留钩子","polished",'["回答完","反问前"]','[]','[{"label":"模板","quote":"这是我目前的理解，放到贵公司可能需要调整。"}]',3],
    ["c22","phrase","开场定调句","缓冲","draft",'["不好接的问题"]','[]','[{"label":"模板","quote":"这个问题很好，我从两个层面来看。"}]',4]
  ];
  for (const c of cards) {
    await pool.query(`INSERT INTO cards (id,"moduleId",title,subtitle,status,scenes,"dataTags",sections,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, c);
  }
  console.log("seeded");
}

function parseCard(row) {
  if (!row) return null;
  return {
    id: row.id, moduleId: row.moduleId, title: row.title, subtitle: row.subtitle,
    status: row.status,
    scenes: JSON.parse(row.scenes || "[]"),
    dataTags: JSON.parse(row.dataTags || "[]"),
    sections: JSON.parse(row.sections || "[]"),
    order: row.sort_order
  };
}

function parseModule(row) {
  if (!row) return null;
  const m = { id: row.id, title: row.title, description: row.description, icon: row.icon, order: row.sort_order };
  if (row.resumeData) {
    try { m.resumeData = JSON.parse(row.resumeData); } catch(e) {}
  }
  return m;
}

// Routes
app.get("/api/modules", async (req, res) => {
  const r = await pool.query(`SELECT * FROM modules ORDER BY sort_order`);
  res.json(r.rows.map(parseModule));
});

app.post("/api/modules", async (req, res) => {
  const id = uuidv4();
  const { title = "新模块", description = "", icon = "📄" } = req.body;
  const ord = await pool.query(`SELECT COALESCE(MAX(sort_order),0)+1 as n FROM modules`);
  const order = ord.rows[0].n;
  await pool.query(`INSERT INTO modules (id,title,description,icon,sort_order) VALUES ($1,$2,$3,$4,$5)`, [id, title, description, icon, order]);
  const r = await pool.query(`SELECT * FROM modules WHERE id=$1`, [id]);
  res.json(parseModule(r.rows[0]));
});

app.put("/api/modules/:id", async (req, res) => {
  const { title, description, icon, resumeData } = req.body;
  const sets = []; const vals = [];
  if (title !== undefined) { sets.push("title=$"+(vals.length+1)); vals.push(title); }
  if (description !== undefined) { sets.push("description=$"+(vals.length+1)); vals.push(description); }
  if (icon !== undefined) { sets.push("icon=$"+(vals.length+1)); vals.push(icon); }
  if (resumeData !== undefined) { sets.push('"resumeData"=$'+(vals.length+1)); vals.push(JSON.stringify(resumeData)); }
  if (!sets.length) return res.status(400).end();
  vals.push(req.params.id);
  await pool.query(`UPDATE modules SET ${sets.join(",")} WHERE id=$${vals.length}`, vals);
  const r = await pool.query(`SELECT * FROM modules WHERE id=$1`, [req.params.id]);
  res.json(parseModule(r.rows[0]));
});

app.delete("/api/modules/:id", async (req, res) => {
  await pool.query(`DELETE FROM cards WHERE "moduleId"=$1`, [req.params.id]);
  await pool.query(`DELETE FROM modules WHERE id=$1`, [req.params.id]);
  res.json({ ok: 1 });
});

app.get("/api/modules/:moduleId/cards", async (req, res) => {
  const r = await pool.query(`SELECT * FROM cards WHERE "moduleId"=$1 ORDER BY sort_order`, [req.params.moduleId]);
  res.json(r.rows.map(parseCard));
});

app.post("/api/modules/:moduleId/cards", async (req, res) => {
  const id = uuidv4();
  const ord = await pool.query(`SELECT COALESCE(MAX(sort_order),0)+1 as n FROM cards WHERE "moduleId"=$1`, [req.params.moduleId]);
  const order = ord.rows[0].n;
  await pool.query(`INSERT INTO cards (id,"moduleId",title,subtitle,status,scenes,"dataTags",sections,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, req.params.moduleId, "新卡片", "", "draft", "[]", "[]", '[{"label":"内容","quote":""}]', order]);
  const r = await pool.query(`SELECT * FROM cards WHERE id=$1`, [id]);
  res.json(parseCard(r.rows[0]));
});

app.put("/api/cards/:id", async (req, res) => {
  const { title, subtitle, status, scenes, dataTags, sections } = req.body;
  const sets = []; const vals = [];
  if (title !== undefined) { sets.push("title=$"+(vals.length+1)); vals.push(title); }
  if (subtitle !== undefined) { sets.push("subtitle=$"+(vals.length+1)); vals.push(subtitle); }
  if (status !== undefined) { sets.push("status=$"+(vals.length+1)); vals.push(status); }
  if (scenes !== undefined) { sets.push("scenes=$"+(vals.length+1)); vals.push(JSON.stringify(scenes)); }
  if (dataTags !== undefined) { sets.push('"dataTags"=$'+(vals.length+1)); vals.push(JSON.stringify(dataTags)); }
  if (sections !== undefined) { sets.push("sections=$"+(vals.length+1)); vals.push(JSON.stringify(sections)); }
  if (!sets.length) return res.status(400).end();
  vals.push(req.params.id);
  await pool.query(`UPDATE cards SET ${sets.join(",")} WHERE id=$${vals.length}`, vals);
  const r = await pool.query(`SELECT * FROM cards WHERE id=$1`, [req.params.id]);
  res.json(parseCard(r.rows[0]));
});

app.delete("/api/cards/:id", async (req, res) => {
  await pool.query(`DELETE FROM cards WHERE id=$1`, [req.params.id]);
  res.json({ ok: 1 });
});

app.put("/api/data/restore", (req, res) => res.json({ ok: 1 }));

init().then(() => {
  app.listen(PORT, "0.0.0.0", () => console.log("workbench on http://0.0.0.0:" + PORT));
}).catch(e => {
  console.error("DB init failed:", e.message);
  process.exit(1);
});
