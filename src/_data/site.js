const contact_email = 'contact@elysium.ngo';

module.exports = {
  network_name: 'Elysium+',
  network_full: 'Elysium+ Network',
  tagline: 'Empowering young people to create positive change',
  founded_year: 2020,
  contact_email,
  // Update once a custom domain is attached to the Cloudflare Pages project —
  // this backs canonical URLs and Open Graph og:url tags.
  url: 'https://elysiumnetwork.pages.dev',
  default_description: 'Elysium+ is a European youth network rooted in Ukraine, moving young people across Ukraine, Poland, Italy and Germany.',
  logo_small: '/assets/logo-128.png',
  logo_hero: '/assets/logo-320.png',
  og_image: '/assets/og-image.png',
  favicon_32: '/assets/favicon-32.png',
  favicon_48: '/assets/favicon-48.png',
  apple_touch_icon: '/assets/apple-touch-icon.png',
  join_form: 'mailto:' + contact_email + '?subject=' + encodeURIComponent('I want to join Elysium+'),
  hub: 'https://hub.elysium.ngo/',
  astra_site: 'https://astra.ngo',

  socials: [
    { label: 'Instagram', url: 'https://www.instagram.com/beyondborders.ngo', icon: 'instagram' },
    { label: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61582982678651', icon: 'facebook' },
    { label: 'Telegram', url: 'https://t.me/ElysiumNGO', icon: 'telegram' },
    { label: 'WhatsApp', url: 'https://wa.me/message/PK3TQ4FNCQ5VC1', icon: 'whatsapp' },
    { label: 'Email', url: 'mailto:contact@elysium.ngo', icon: 'mail' },
  ],

  mission: 'Our mission is to empower young people through education, mobility and active participation. We believe every young person has the right to learn, explore and shape their own future — regardless of background or nationality. Guided by the European values of democracy, equality, solidarity and respect for human dignity, we create opportunities for growth, intercultural understanding and civic engagement.',
  vision: 'A Europe where young people lead change — a continent united by cooperation, inclusion and innovation. We work toward a society where education and lifelong learning are accessible to all, and where youth are active contributors to sustainable development, peace and social justice.',
  values_short: [
    ['Freedom & equality', 'Equal access to education, opportunities and participation.', 'Every person in our network has the same right to learn, take part and be heard — regardless of nationality, gender, identity, background or belief. We don’t tolerate discrimination of any kind, and equal access to our educational and mobility opportunities is a starting point, not an aspiration.'],
    ['Solidarity & inclusion', 'Unity, respect and understanding across diverse cultures.', 'We support one another instead of competing — sharing knowledge, covering costs where we can and adapting formats so no one is excluded because of language, background or personal circumstance. Priority goes to young people facing real barriers, including displacement and limited prior access to international exchange.'],
    ['Sustainability', 'Initiatives that protect both people and the planet.', 'Ecological responsibility is built into how we plan activities, not treated as a side project — from transport choices like favouring rail travel for exchanges when possible, to the themes we bring into our non-formal education sessions.'],
    ['Youth empowerment', 'Self-development, creativity and leadership in every young person.', 'We treat every participant as someone capable of leading, not just attending — encouraging curiosity, creativity and responsibility, and creating space for young people to help shape the activities they take part in rather than just consume them.'],
  ],

  themes: [
    { icon: 'globe', title: 'International mobility', text: 'Youth exchanges, training courses and DiscoverEU journeys that send young people across Europe.', detail: 'Through Erasmus+ and other funded frameworks, we organise youth exchanges, training courses and DiscoverEU-style journeys that take participants across our four branch countries and their wider partner network. Every mobility is built around a learning objective, from civic education to media literacy, so participants come home with new skills, contacts and perspective — not just a stamp in their passport.' },
    { icon: 'spark', title: 'Non-formal education', text: 'Interactive, learning-by-doing sessions on media literacy, leadership and civic life.', detail: 'Rather than lectures, our sessions use non-formal education methods — simulations, workshops, group challenges and reflection circles — to build practical skills in leadership, critical thinking and civic participation. Facilitators are trained volunteers and partners from across the network, so every session carries real lived experience alongside the theory.' },
    { icon: 'heart', title: 'Inclusion', text: 'Priority for young people with fewer opportunities — displacement, social or mobility barriers.', detail: 'We actively prioritise participants who face real barriers to opportunity: young people displaced by the war in Ukraine, those from lower-income households or rural areas, or anyone with limited prior access to international exchange. Support includes covering travel and accommodation costs and adapting formats so language or experience gaps are never a reason to be excluded.' },
    { icon: 'monitor', title: 'Digital engagement', text: 'Online content and sessions that reach rural youth and IDP communities.', detail: 'Not everyone can travel to join us in person, so we run online sessions, webinars and digital content alongside our physical activities — designed specifically to reach young people in rural areas and internally displaced communities who would otherwise be cut off from the network entirely.' },
    { icon: 'vote', title: 'Democratic participation', text: 'Campaigns and activities that give young people a real voice in their communities.', detail: 'We run awareness campaigns, local dialogues and participation projects that connect young people directly with civic life — from local decision-making processes to broader European-level advocacy — so participation in democracy is something they’ve practised, not just an abstract idea.' },
    { icon: 'leaf', title: 'Sustainability', text: 'Ecological responsibility woven through our programmes and everyday practice.', detail: 'Sustainability shapes how we run everything rather than sitting apart as a separate initiative — from favouring lower-impact travel for our exchanges when possible, to building environmental themes directly into our non-formal education sessions, so it becomes a habit participants carry home.' },
  ],

  branches: [
    {
      tz: 'Europe/Kyiv', lat: '51.50°N', lon: '31.29°E',
      slug: 'ukraine', flag: '🇺🇦', iso_n3: '804',
      name: 'Elysium+ Ukraine', name_native: 'ГО «Елізіум+»',
      country: 'Ukraine', city: 'Chernihiv',
      oid: 'E10407340', type: 'Civil Organisation (NGO)',
      status: 'Founding organisation', accent: '#FFD23F',
      tagline: 'Where the network began.',
      about: 'Elysium+ began as a school initiative in 2020 and grew into a registered NGO in Ukraine in 2025. From the start the mission has stayed the same: to promote European values, intercultural dialogue, civic engagement and personal development among young people. Today it works at the intersection of youth empowerment, digital development, international mobility and non-formal education — and acts as the sending organisation for the wider network.',
      focus: ['Youth awareness & civic participation', 'Non-formal education programmes', 'Digital engagement & European cooperation', 'Support for displaced & rural youth'],
      people: [
        { name: 'Anton Rubanenko', role: 'Head of the NGO · Project Manager', email: 'rubanenko@elysium.ngo' },
        { name: 'Jonas Hanke', role: 'Youth Worker · IT Support', email: 'hanke@elysium.ngo' },
      ],
      email: 'contact@elysium.ngo', phone: '+380 93 861 43 05',
      address: 'Peremohy Avenue 119A, apt. 307, 14000 Chernihiv, Ukraine',
      website: null,
    },
    {
      tz: 'Europe/Warsaw', lat: '52.18°N', lon: '21.57°E',
      slug: 'poland', flag: '🇵🇱', iso_n3: '616',
      name: 'Elysium+ Poland', name_native: 'Elysium+ Polska',
      country: 'Poland', city: 'Mińsk Mazowiecki',
      oid: 'E10418127', type: 'Informal Group of Young People',
      status: 'Active branch', accent: '#FF5C72',
      tagline: 'Human rights at the core.',
      about: 'Elysium+ Polska is a youth-focused, non-profit initiative committed to human rights, democratic values and social inclusion. Its work is grounded in dignity, equality, solidarity and respect for diversity, and it uses youth engagement and non-formal learning to empower young people — especially those with fewer opportunities — to build awareness, responsibility and active citizenship.',
      focus: ['Human rights education', 'Democratic participation', 'Social inclusion', 'Intercultural understanding'],
      people: [
        { name: 'Aleksandra Sulejewska', role: 'Group Coordinator · Communication', email: 'sulejewska.pl@elysium.ngo' },
        { name: 'Błażej Wypart', role: 'Youth Worker · Project Manager', email: 'contact.pl@elysium.ngo' },
      ],
      email: 'contact.pl@elysium.ngo', phone: '+48 781 147 586',
      address: 'Jana Łupińskiego 5/1, 05-300 Mińsk Mazowiecki, Poland',
      website: null,
    },
    {
      tz: 'Europe/Rome', lat: '44.92°N', lon: '7.25°E',
      slug: 'italy', flag: '🇮🇹', iso_n3: '380',
      name: 'Elysium+ Italy', name_native: 'Elysium+ Italia',
      country: 'Italy', city: 'San Pietro Val Lemina',
      oid: 'E10417547', type: 'Informal Group of Young People',
      status: 'Active branch', accent: '#34D399',
      tagline: 'Mobility as a bridge.',
      about: 'Elysium+ Italy is a youth-focused, non-profit initiative promoting youth mobility, social inclusion and active citizenship. It treats mobility as a key instrument for intercultural understanding and democratic participation across Europe, and aligns its work with SDG 10 (Reduced Inequalities) and SDG 11 (Sustainable Cities & Communities), with particular attention to young people with fewer opportunities.',
      focus: ['Inclusive youth mobility', 'Active citizenship', 'Intercultural learning', 'SDG 10 & SDG 11'],
      people: [
        { name: 'Andrea Dal Molin', role: 'Group Coordinator', email: 'dalmolin.it@elysium.ngo' },
        { name: 'Anton Rubanenko', role: 'Network Coordinator', email: 'rubanenko@elysium.ngo' },
      ],
      email: 'contact@elysium.ngo', phone: '+39 392 7120202',
      address: 'Via P.G. Frassati 9, 10060 San Pietro Val Lemina, Italy',
      website: null,
    },
    {
      tz: 'Europe/Berlin', lat: '51.34°N', lon: '12.37°E',
      slug: 'germany', flag: '🇩🇪', iso_n3: '276',
      name: 'Astra', name_native: 'Astra gUG (haftungsbeschränkt) i.Gr.',
      country: 'Germany', city: 'Leipzig',
      oid: 'E10407336', type: 'gemeinnützige UG (in formation)',
      status: 'In formation', accent: '#8B7CFF',
      tagline: 'The German branch, in the making.',
      about: 'Astra is the German branch of the network, being established as a gemeinnützige Unternehmergesellschaft (gUG) with its registered seat in Aachen and operations in Leipzig. It runs fully funded Erasmus+ projects across Europe — exchanges, training and youth-led activities — built on inclusion, democracy and exchange. Registration in the Handelsregister is in progress, so the entity currently carries the "i.Gr." (in formation) suffix.',
      focus: ['Erasmus+ project management', 'Youth exchanges & training', 'DiscoverEU', 'Leipzig & eastern Germany focus'],
      people: [
        { name: 'Jonas Hanke', role: 'Founder · Managing Director', email: 'hanke@elysium.ngo' },
        { name: 'Anton Rubanenko', role: 'Co-founder', email: 'rubanenko@elysium.ngo' },
      ],
      email: 'hanke@elysium.ngo', phone: null,
      address: 'Registered seat: Aachen · Operations: Leipzig, Germany',
      website: 'https://astra.ngo',
    },
  ],

  globe_excluded: { '643': 'Russia', '112': 'Belarus' },

  team: [
    // focalY: vertical object-position for the card thumbnail — these are
    // portrait/full-body photos being cropped into a short landscape box, so
    // a plain center crop cuts heads off on anyone whose face isn't dead
    // centre in the source photo. Tuned per photo instead of one blanket value.
    { name: 'Anton Rubanenko', role: 'Founder & Project Manager',
      image: '/assets/team/anton-rubanenko.jpg', focalY: '10%',
      bio: 'Founder of Elysium+ and a youth activist focused on democracy, human rights and cultural exchange. He has joined more than 20 Erasmus+ projects and visited 40+ countries, building the partnerships that empower young people across Europe.' },
    { name: 'Jonas Hanke', role: 'Co-founder & IT Specialist',
      image: '/assets/team/jonas-hanke.jpg', focalY: '48%',
      bio: "Co-founder with a passion for travel, media and cultural discovery, and managing director of the German branch, Astra. Inspired by brutalist architecture, he connects culture, design and youth engagement — and keeps the network's digital infrastructure running." },
    { name: 'Ergün Eraslan', role: 'Associate Member',
      image: '/assets/team/ergun-eraslan.jpg', focalY: '15%',
      bio: 'Youth activist with a background in mechanical engineering. Passionate about equality, innovation and cultural exchange, he has taken part in initiatives addressing discrimination and promoting inclusion.' },
    { name: 'Nourhan Said', role: 'Associate Member',
      image: '/assets/team/nourhan-said.jpg', focalY: '12%',
      bio: 'U.S. Department of State alumna who served with a child-focused organisation in the United States. Her research focuses on migration, gender and refugee studies — the intersection of mobility, protection frameworks and social policy.' },
  ],

  faqs: [
    ['What is Elysium+?', 'Elysium+ is a youth-focused non-profit network that creates opportunities for young people to learn, travel and grow through international mobility and non-formal education. We work across Europe with partners, youth workers and organisations to support inclusion, creativity, digital development and intercultural understanding.'],
    ['Do I need experience to join your projects?', 'No. Most projects are designed for beginners and for young people taking part in international activities for the first time. What matters most is motivation, openness and the desire to learn. Some specialised trainings have specific requirements, which we always indicate in advance.'],
    ['How is Elysium+ funded?', 'Through international project grants — especially Erasmus+ — partnerships with European organisations, and support from local and international collaborators. Community contributions help too; see the Support Us page for ways to help.'],
    ['How can I contribute?', "Beyond donations, you can volunteer, share your skills, or help spread the word about our work. We welcome people interested in online events, creative projects, workshops and digital activities. If you have an idea, we're always open to new proposals."],
  ],

  donation: {
    eur: {
      Beneficiary: '"ELYSIUM+"',
      IBAN: 'UA383220010000026001700010350',
      'SWIFT / BIC': 'UNJSUAUKXXX',
      Bank: 'Universal Bank',
      Address: 'Peremohy Avenue 119A, apt. 307, Chernihiv, Ukraine',
    },
    uah: {
      Organisation: 'NGO "ELYSIUM +"',
      EDRPOU: '46047605',
      Account: 'UA793220010000026006700009054',
      Bank: 'JSC "UNIVERSAL BANK"',
      MFO: '322001',
    },
  },
};
