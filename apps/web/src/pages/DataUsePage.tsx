import type {User} from '../services/api';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import '../styles/data-use.css';

// Public, non-blocking explanation. This is not a new consent screen and
// does not replace separately required resume / third-party data authorization.
export function DataUsePage({user}:{user:User|null}){
 return <Shell user={user}>
  <article className="hhba-data-use" aria-labelledby="hhba-data-use-heading">
   <span className="hhba-data-use-kicker">HHBA · 数据透明</span>
   <h1 id="hhba-data-use-heading">运营数据使用说明</h1>
   <p className="hhba-data-use-lead">我们希望网站正常使用时不反复打断你，同时如实说明平台记录了哪些运营数据、哪些数据没有采集。</p>
   <section>
    <h2>不关联访客身份的运营事件</h2>
    <p>为了解页面和服务的实际使用情况，HHBA 对公开页面访问、岗位浏览、岗位搜索操作及前往官方招聘链接的点击进行次数汇总。每条记录包含 UTC 日期、事件类型和写入时间；服务端为每次事件生成不可复用的随机记录值，仅用于事件行区分。</p>
    <p>此类事件不会写入手机号、登录账号、简历、搜索词、具体网页路径或岗位编号；不为访问统计设置访客 Cookie，也不会使用跨次访问的固定访客标识。浏览器的 DNT/GPC 隐私偏好和此前明确拒绝统计的选择会继续受到尊重。</p>
    <p>这些是实际发生的<strong>事件次数</strong>，不是去重访客人数。平台不会用 PV 推算 UV、DAU、WAU、MAU 或账号留存率。</p>
   </section>
   <section>
    <h2>真实业务记录与运营事件分开</h2>
    <p>真实注册账号数量、已收藏岗位数量和收藏人数来自登录后的业务数据库，仅用于提供注册、登录、个人收藏与相应管理服务，不与上述访问次数拼接成个人浏览轨迹。账号级浏览活动采集已停止新增；已存在的旧记录仍提供本人核验及删除途径。</p>
    <p>页面正常浏览、岗位搜索和查看人才政策，不需要再点击一个运营统计同意弹窗。</p>
   </section>
   <section>
    <h2>简历与主动公开资料仍由你决定</h2>
    <p>上传简历时保留针对私有文件存储的必要告知与授权；启动简历智能匹配时，仍需对将简历内容发送给第三方 AI 分析作出独立选择。公开个人能力名片、允许企业检索或公开分享，也由用户单独控制。</p>
    <p>如需查看或清理旧版账号统计记录，可在登录后前往 <Link to="/candidate/account/privacy">账户与隐私</Link>。清理旧版统计不会清除你正常保存的岗位收藏。</p>
   </section>
   <section>
    <h2>数据使用边界</h2>
    <p>运营计数以最少字段收集；具体事件的保留期限和自动清理机制尚待平台完成专项治理验收，在确认前不宣称已经自动定期删除。网络服务供应商在传输、安全防护环节可能依据自身服务规则处理连接信息，该环节不等同于 HHBA 的运营事件数据库。</p>
    <p>本页仅说明上述运营数据实践，不能替代涵盖处理主体、联系方式、账户及简历保存期限、第三方与跨境处理等事项的完整隐私政策；正式推广前须补齐并公开相应信息。</p>
   </section>
   <p className="hhba-data-use-foot">说明更新：2026 年 11 月 4 日 · 本页面不是授权申请，不要求用户勾选。</p>
  </article>
 </Shell>;
}
