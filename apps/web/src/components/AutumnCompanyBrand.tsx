import {DomesticBrandMark} from './DomesticBrandMark';
import {domesticBrandFor} from '../services/domesticCompanyBrand';

export function AutumnCompanyBrand({name,large=false}:{name:string;large?:boolean}){
 const hasLogo=!!domesticBrandFor({name});
 return <DomesticBrandMark name={name} size={large?31:19}
 className={'hhba-autumn-brand '+(large?'hhba-autumn-brand-large':'')+
 (hasLogo?' hhba-autumn-brand-has-logo':' hhba-autumn-brand-missing')}/>;
}
