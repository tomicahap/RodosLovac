export const getPlaceLand = (place: string | null): string | null => {
  if (!place) return null;
  const parts = place.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 2]; // second-to-last, e.g. "Vukovar-Srijem"
  }
  return parts[0] || null;
};

export const getCountryFromPlace = (place: string | null): string => {
  if (!place) return 'Nepoznato';
  const norm = place.toLowerCase();
  
  if (norm.includes('hrvatsk') || norm.includes('croatia')) return 'Hrvatska';
  if (norm.includes('hungary') || norm.includes('mađarsk') || norm.includes('magyar')) return 'Mađarska';
  if (norm.includes('czech') || norm.includes('češk')) return 'Češka';
  if (norm.includes('austria') || norm.includes('austrija') || norm.includes('österreich')) return 'Austrija';
  if (norm.includes('germany') || norm.includes('nemačk') || norm.includes('deutsch')) return 'Njemačka';
  if (norm.includes('bosn')) return 'Bosna i Hercegovina';
  if (norm.includes('serbi') || norm.includes('srbi')) return 'Srbija';
  if (norm.includes('sloven')) return 'Slovenija';
  if (norm.includes('ital')) return 'Italija';
  
  // Specific Hungarian villages present in this tree (Porva, Marko/Márkó, Tes/Tés)
  if (norm.includes('porva') || norm.includes('marko') || norm.includes('márkó') || norm.includes('tes') || norm.includes('tés')) {
    return 'Mađarska';
  }
  
  return 'Hrvatska'; // default fallback for unspecified towns in this tree
};

export const getHistoricalState = (modernCountry: string, year: number | null): string => {
  if (!year) return modernCountry;

  if (modernCountry === 'Hrvatska' || modernCountry === 'Bosna i Hercegovina' || modernCountry === 'Slovenija' || modernCountry === 'Srbija') {
    if (year < 1527) return 'Kraljevina Hrvatska';
    if (year < 1867) return 'Habsburška Monarhija / Austrijsko Carstvo';
    if (year < 1918) return 'Austro-Ugarska Monarhija';
    if (year < 1929) return 'Kraljevina SHS';
    if (year < 1941) return 'Kraljevina Jugoslavija';
    if (year < 1945) return 'NDH';
    if (year < 1991) return 'SFR Jugoslavija';
    return modernCountry;
  }
  
  if (modernCountry === 'Mađarska' || modernCountry === 'Češka' || modernCountry === 'Austrija') {
    if (year < 1804) return 'Habsburška Monarhija';
    if (year < 1867) return 'Austrijsko Carstvo';
    if (year < 1918) return 'Austro-Ugarska Monarhija';
    return modernCountry;
  }

  if (modernCountry === 'Njemačka') {
    if (year < 1806) return 'Sveto Rimsko Carstvo';
    if (year < 1871) return 'Njemački Savez';
    if (year < 1918) return 'Njemačko Carstvo';
    if (year < 1945) return 'Weimarska Republika / Treći Reich';
    if (year < 1990) return 'Zapadna i Istočna Njemačka';
    return modernCountry;
  }

  return modernCountry;
};
