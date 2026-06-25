import * as fs from 'fs';
import { parseGedcom } from './src/parser/gedcomParser';
import { TreeGraph } from './src/parser/treeGraph';
import { analyzePedigreeCollapse } from './src/modules/Research/utils/pedigreeCollapseAnalyzer';

async function run() {
  const fileContent = fs.readFileSync('C:\\Users\\Tomica Hap\\Downloads\\probazaAI.ged', 'utf8');
  const tree = parseGedcom(fileContent);
  new TreeGraph(tree);
  
  console.log(`Ukupno osoba: ${tree.persons.size}`);
  console.log(`Ukupno obitelji: ${tree.families.size}`);
  let personsWithParents = 0;
  tree.persons.forEach(p => { if (p._parents && p._parents.length > 0) personsWithParents++; });
  console.log(`Osoba sa poznatim roditeljima (_parents): ${personsWithParents}`);

  let famsWithBoth = 0;
  tree.families.forEach(f => { if (f.husband && f.wife) famsWithBoth++; });
  console.log(`Obitelji sa mužem i ženom: ${famsWithBoth}`);

  const results = analyzePedigreeCollapse(tree);
  
  console.log(`Pronađeno ukupno ${results.totalMarriages} brakova u srodstvu.`);
  console.log('Kategorije:', results.relationshipCounts);
  
  const s6 = results.marriages.filter((m: any) => m.sDegree === 6);
  console.log(`\nBrakovi sa S=6 (Zajednički pradjed / Drugi bratići): ${s6.length}`);
  
  s6.forEach((m: any) => {
    console.log(`- ${m.husbandName} x ${m.wifeName} (S=${m.sDegree}, F=${m.fValue})`);
    m.commonAncestorPairs.forEach((p: any) => {
      console.log(`  preko: ${p.ancestor1Name} & ${p.ancestor2Name} (H=${p.distanceHusband}, W=${p.distanceWife})`);
    });
  });
}

run().catch(console.error);
