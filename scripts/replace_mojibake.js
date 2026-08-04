const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'src');
const exts = new Set(['.ts','.tsx','.js','.jsx','.html','.md']);
const patterns = [
  'â‚¹',
  'Ã¢â€šÂ¹',
  'Ã¢â‚¬Â¹',
  'Ã¢â‚¬Â¢',
  'Ã¢â€žÂ¢',
  'Ã¢â€šÂ '
];
function walk(dir){
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for(const e of entries){
    const p = path.join(dir, e.name);
    if(e.isDirectory()) walk(p);
    else if(exts.has(path.extname(e.name))){
      try{
        let s = fs.readFileSync(p, 'utf8');
        let replaced = false;
        for(const pat of patterns){
          if(s.indexOf(pat) !== -1){ s = s.split(pat).join('₹'); replaced = true; }
        }
        if(replaced){
          fs.writeFileSync(p, s, 'utf8');
          console.log('Replaced in:', p);
        }
      }catch(err){/* ignore */}
    }
  }
}
walk(root);
console.log('Done');
