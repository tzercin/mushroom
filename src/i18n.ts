import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Lang } from './data/types'

const resources = {
  tr: {
    translation: {
      title: 'Mantar Ağı',
      subtitle: 'Türkiye mantarlarının evrim ağı',
      search: 'Mantar ara…',
      noResults: 'Sonuç yok',
      hint: 'Sürükle: döndür · Kaydır: yakınlaştır · Tıkla: keşfet',
      overview: 'Tüm ağ',
      view: {
        default: 'Varsayılan',
        defaultHint: 'Tüm ağı ortala',
        center: 'Ortala',
        centerHint: 'Seçili olanı ortala',
        zoomIn: 'Yakınlaştır',
        zoomOut: 'Uzaklaştır',
      },
      close: 'Kapat',
      species_one: '{{count}} tür',
      species_other: '{{count}} tür',
      habitat: 'Yaşam alanı',
      lookalikes: 'Karıştırılabileceği türler',
      relatives: 'Yakın akrabalar',
      cousins: 'Aynı familyadan',
      branches: 'Dallar',
      lineage: 'Soy hattı',
      photoSoon: 'Fotoğraf yakında',
      distribution: {
        title: { turkey: 'Türkiye’deki kayıtlar', world: 'Dünyadaki kayıtlar' },
        view: { turkey: 'Türkiye', world: 'Dünya' },
        records_one: '{{count}} kayıt',
        records_other: '{{count}} kayıt',
        provinces_one: '{{count}} il',
        provinces_other: '{{count}} il',
        countries_one: '{{count}} ülke',
        countries_other: '{{count}} ülke',
        noRecords: 'kayıt yok',
        worldNote: 'Renk tonu kayıt sayısını gösterir; bu da türün ne kadar yaygın olduğundan çok, o ülkede ne kadar mantar gözlemcisi olduğuna bağlıdır.',
        recordedHere: 'kayıt var',
        none: 'GBIF’te henüz konumlu kayıt yok',
        note: 'Noktalar türün gözlemlendiği yerleri gösterir, yayılışının tamamını değil.',
        boundaries: 'Sınırlar',
      },
      disclaimer:
        'Bu site eğitim amaçlıdır. Yabani mantarları yalnızca bir uzmana danışarak toplayın ve yiyin; birçok zehirli tür, yenen türlere çok benzer.',
      legend: 'Soylar',
      rank: {
        kingdom: 'Alem',
        phylum: 'Şube',
        class: 'Sınıf',
        order: 'Takım',
        family: 'Familya',
        genus: 'Cins',
        species: 'Tür',
      },
      ranks: {
        kingdom: 'Alemler',
        phylum: 'Şubeler',
        class: 'Sınıflar',
        order: 'Takımlar',
        family: 'Familyalar',
        genus: 'Cinsler',
        species: 'Türler',
      },
      edibility: {
        edible: 'Yenir',
        'edible-caution': 'Dikkatle yenir',
        medicinal: 'Tıbbi',
        inedible: 'Yenmez',
        toxic: 'Zehirli',
        deadly: 'Ölümcül',
      },
    },
  },
  en: {
    translation: {
      title: 'Mycelium',
      subtitle: 'The evolutionary network of Türkiye’s mushrooms',
      search: 'Search mushrooms…',
      noResults: 'No results',
      hint: 'Drag to rotate · Scroll to zoom · Click to explore',
      overview: 'Whole network',
      view: {
        default: 'Default',
        defaultHint: 'Show the whole network',
        center: 'Center',
        centerHint: 'Center the selection',
        zoomIn: 'Zoom in',
        zoomOut: 'Zoom out',
      },
      close: 'Close',
      species_one: '{{count}} species',
      species_other: '{{count}} species',
      habitat: 'Habitat',
      lookalikes: 'Can be confused with',
      relatives: 'Closest relatives',
      cousins: 'Same family',
      branches: 'Branches',
      lineage: 'Lineage',
      photoSoon: 'Photo coming soon',
      distribution: {
        title: { turkey: 'Records in Türkiye', world: 'Records worldwide' },
        view: { turkey: 'Türkiye', world: 'World' },
        records_one: '{{count}} record',
        records_other: '{{count}} records',
        provinces_one: '{{count}} province',
        provinces_other: '{{count}} provinces',
        countries_one: '{{count}} country',
        countries_other: '{{count}} countries',
        noRecords: 'no records',
        worldNote: 'Shading shows the number of records, which says more about how many people look for fungi in a country than how common the species is there.',
        recordedHere: 'recorded',
        none: 'No geolocated records on GBIF yet',
        note: 'Dots show where the species has been recorded, not its full range.',
        boundaries: 'Boundaries',
      },
      disclaimer:
        'This site is for education only. Never eat a wild mushroom without checking with an expert; many poisonous species closely resemble edible ones.',
      legend: 'Lineages',
      rank: {
        kingdom: 'Kingdom',
        phylum: 'Phylum',
        class: 'Class',
        order: 'Order',
        family: 'Family',
        genus: 'Genus',
        species: 'Species',
      },
      ranks: {
        kingdom: 'Kingdoms',
        phylum: 'Phyla',
        class: 'Classes',
        order: 'Orders',
        family: 'Families',
        genus: 'Genera',
        species: 'Species',
      },
      edibility: {
        edible: 'Edible',
        'edible-caution': 'Edible with care',
        medicinal: 'Medicinal',
        inedible: 'Inedible',
        toxic: 'Poisonous',
        deadly: 'Deadly',
      },
    },
  },
}

const stored = localStorage.getItem('lang')
const initial: Lang = stored === 'tr' || stored === 'en' ? stored : navigator.language.startsWith('tr') ? 'tr' : 'en'

i18n.use(initReactI18next).init({
  resources,
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('lang', lng)
  document.documentElement.lang = lng
})
document.documentElement.lang = initial

export default i18n
