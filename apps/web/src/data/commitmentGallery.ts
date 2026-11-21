/** Brand-wall slots. Empty src renders a typographic placeholder.
 * To publish: add a licensed/owned photo under public/images/commitment,
 * then set src and its truthful accessible alt description.
 */
export type CommitmentPhoto={id:string;eyebrow:string;title:string;caption:string;src:string;alt:string};
export const commitmentGallery:CommitmentPhoto[]=[
 {id:'01',eyebrow:'THE BEGINNING',title:'机会，从这里开始。',caption:'关于每一次重新出发。',src:'',alt:''},
 {id:'02',eyebrow:'THE CHOICE',title:'每一个职业选择，都值得认真对待。',caption:'关于真实的信息与自主决定。',src:'',alt:''},
 {id:'03',eyebrow:'THE JOURNEY',title:'让成长，有迹可循。',caption:'关于工作之后，仍然不断展开的人生。',src:'',alt:''}
];
