const fs = require('fs');
const path = require('path');
const dir = 'C:\\Users\\Tomica Hap\\Downloads\\predci\\src\\modules\\Research\\tabs';

if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const tabs = ['DuplicatesTab', 'ResearchGapsTab', 'BrickWallsTab', 'NamingPatternsTab', 'JewishNamesTab', 'PedigreeCollapseTab', 'DNAPlannerTab'];

tabs.forEach(tab => {
  const content = `import React from 'react';

export default function ${tab}() {
  return (
    <div className="p-6 flex flex-col items-center justify-center h-full text-slate-500">
      <div className="text-4xl mb-4">🚧</div>
      <h2 className="text-xl font-bold text-slate-700 mb-2">Alat u pripremi</h2>
      <p className="text-sm text-center max-w-md">Ovaj analitički modul se priprema za rad. Ovdje će biti dostupne sve funkcionalnosti vezane uz ${tab}.</p>
    </div>
  );
}
`;
  fs.writeFileSync(path.join(dir, tab + '.tsx'), content);
});

console.log("Tabovi uspješno generirani!");
