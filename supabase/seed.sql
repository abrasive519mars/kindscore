-- Kindscore · seed · the seven demo charities (fictional) and their events
-- Applied by `supabase db reset` locally and by scripts/seed.ts in the cloud. Deterministic ids so
-- tests, the photo manifest (public/seed/<slug>/) and later seeds can refer to them.
-- Users, subscriptions, scores and draws are seeded by scripts/seed.ts (Phase 11) — they need the Auth admin API.

insert into charities (id, slug, name, tagline, description, category, city, outcome_line, cover_path, featured_rank) values
(
  'c0000000-0000-4000-8000-000000000001', 'sahaj-shiksha', 'Sahaj Shiksha Foundation',
  'Keeping girls in school in rural Telangana.',
  'Sahaj Shiksha runs after-school learning centres in 40 villages across Nalgonda and Warangal districts, where girls are the first in their families to finish secondary school. Local women trained as tutors run each centre; the foundation covers books, exam fees and a daily meal so that money is never the reason a girl drops out. Since 2019, 92% of enrolled girls have completed Class 10.',
  'Education', 'Nalgonda', '₹50 a month = 5 school days for one girl', 'seed/sahaj-shiksha/cover.webp', null
),
(
  'c0000000-0000-4000-8000-000000000002', 'neer-jal', 'Neer Jal Trust',
  'Clean water within a ten-minute walk.',
  'In the dry villages of Rayalaseema, women walk up to two hours a day for water. Neer Jal Trust repairs and builds community handpumps and rooftop rainwater tanks, trains a village maintenance committee for each one, and tests water quality every quarter. A working pump gives 80 households back the hours they spent carrying pots.',
  'Water', 'Anantapur', '₹50 a month = clean water for one family for a fortnight', 'seed/neer-jal/cover.webp', null
),
(
  'c0000000-0000-4000-8000-000000000003', 'hara-bhara', 'Hara Bhara Initiative',
  'Shade for the streets of Hyderabad.',
  'Hara Bhara plants native trees along roads, school compounds and lake bunds in Hyderabad and Secunderabad, and — the part most tree drives skip — waters and guards each sapling for three years until it can survive on its own. Volunteers adopt a stretch of road; the initiative supplies saplings, guards and a monthly water tanker. 11,400 trees planted; 9,700 still standing.',
  'Environment', 'Hyderabad', '₹50 a month = one sapling watered and guarded for a season', 'seed/hara-bhara/cover.webp', null
),
(
  'c0000000-0000-4000-8000-000000000004', 'roshni-netra', 'Roshni Netra Care',
  'Sight restored, one camp at a time.',
  'Roshni Netra Care runs weekend eye camps in the villages around Warangal, screening for cataract and refractive error and bringing patients who need surgery to a partner hospital in the city at no cost. Most patients are over sixty and have been unable to work or read for years; a twenty-minute operation gives that back. 3,200 surgeries since 2017.',
  'Health', 'Warangal', '₹50 a month = twelve eye screenings at a village camp', 'seed/roshni-netra/cover.webp', null
),
(
  'c0000000-0000-4000-8000-000000000005', 'ashray-paws', 'Ashray Paws Rescue',
  'Care for the dogs everyone walks past.',
  'Ashray Paws feeds, vaccinates and sterilises street dogs across Secunderabad, and runs a small shelter for the injured ones. Every dog treated is tagged and returned to its own street — the humane way to a stable, rabies-free street population. The team answers rescue calls seven days a week.',
  'Animals', 'Secunderabad', '₹50 a month = one dog vaccinated and fed for a week', 'seed/ashray-paws/cover.webp', null
),
(
  'c0000000-0000-4000-8000-000000000006', 'sanjeevani', 'Sanjeevani Rural Health Mission',
  'A doctor who comes to the village.',
  'Sanjeevani runs two mobile clinics through the tribal blocks of Adilabad district, where the nearest primary health centre can be forty kilometres away. Each van carries a doctor, a nurse and a pharmacy, visits every village on a fixed fortnightly rota, and refers serious cases onward. Regular visits mean blood pressure and diabetes are managed, not discovered too late.',
  'Health', 'Adilabad', '₹50 a month = three village consultations with medicines', 'seed/sanjeevani/cover.webp', null
),
(
  'c0000000-0000-4000-8000-000000000007', 'udaan-girls-sports', 'Udaan Girls'' Sports Collective',
  'Girls who play stay in school.',
  'Udaan runs football, kabaddi and athletics programmes for girls from low-income neighbourhoods in Hyderabad, coached by women who came up through the same programme. Practice is four evenings a week; kit, transport and a snack are provided. Girls who play with Udaan for a year are three times more likely to finish Class 12 — the field is the reason they stay.',
  'Education', 'Hyderabad', '₹50 a month = a month of coaching, kit and transport for one girl', 'seed/udaan-girls-sports/cover.webp', 1
);

insert into charity_media (charity_id, storage_path, alt, sort_order) values
('c0000000-0000-4000-8000-000000000001', 'seed/sahaj-shiksha/gallery-1.webp', 'A teacher points to Hindi words on a blackboard while girls sit on the floor of a small village classroom.', 1),
('c0000000-0000-4000-8000-000000000001', 'seed/sahaj-shiksha/gallery-2.webp', 'Two young girls concentrate on drawing with crayons at a wooden desk.', 2),
('c0000000-0000-4000-8000-000000000002', 'seed/neer-jal/gallery-1.webp', 'Schoolchildren crowd around a village handpump as one boy drinks straight from the spout.', 1),
('c0000000-0000-4000-8000-000000000002', 'seed/neer-jal/gallery-2.webp', 'Two women carry water vessels on their heads down a dirt road in the morning haze.', 2),
('c0000000-0000-4000-8000-000000000003', 'seed/hara-bhara/gallery-1.webp', 'A woman in a pink sari digs a basin around the base of a young tree with a spade.', 1),
('c0000000-0000-4000-8000-000000000003', 'seed/hara-bhara/gallery-2.webp', 'A woman kneels on freshly turned earth and presses a small sapling into the ground.', 2),
('c0000000-0000-4000-8000-000000000004', 'seed/roshni-netra/gallery-1.webp', 'A woman fits a trial frame on a student during a vision screening camp in a classroom.', 1),
('c0000000-0000-4000-8000-000000000004', 'seed/roshni-netra/gallery-2.webp', 'Profile of an elderly man wearing a trial lens frame as he reads an eye chart.', 2),
('c0000000-0000-4000-8000-000000000005', 'seed/ashray-paws/gallery-1.webp', 'A hand breaks biscuits onto a wet kerb for two tan street dogs.', 1),
('c0000000-0000-4000-8000-000000000005', 'seed/ashray-paws/gallery-2.webp', 'A street dog closes its eyes as a woman reaches down to stroke its head.', 2),
('c0000000-0000-4000-8000-000000000006', 'seed/sanjeevani/gallery-1.webp', 'A gloved health worker examines a young boy''s ear with an otoscope at a health camp.', 1),
('c0000000-0000-4000-8000-000000000006', 'seed/sanjeevani/gallery-2.webp', 'A doctor wraps a blood-pressure cuff around a patient''s arm during a consultation.', 2),
('c0000000-0000-4000-8000-000000000007', 'seed/udaan-girls-sports/gallery-1.webp', 'A young girl in full cricket whites raises her bat at the crease.', 1),
('c0000000-0000-4000-8000-000000000007', 'seed/udaan-girls-sports/gallery-2.webp', 'Three young wrestlers shoulder heavy Indian clubs after training on the riverbank.', 2);

insert into charity_events (charity_id, title, description, starts_at, location) values
('c0000000-0000-4000-8000-000000000007', 'Charity Golf Day', 'Eighteen holes, a shotgun start and lunch. Every green fee funds a year of coaching for one girl.', '2026-11-14 07:30+05:30', 'Hyderabad Golf Association, Hyderabad'),
('c0000000-0000-4000-8000-000000000007', 'Inter-school football finals', 'Come and cheer. Twelve teams, one trophy, open to the public.', '2026-12-06 16:00+05:30', 'Gachibowli Stadium, Hyderabad'),
('c0000000-0000-4000-8000-000000000001', 'Winter book drive', 'Drop off Class 6–10 textbooks and stationery at any collection point across the city.', '2026-12-13 10:00+05:30', 'Multiple collection points, Hyderabad'),
('c0000000-0000-4000-8000-000000000003', 'Monsoon planting weekend', 'Two hundred saplings along the Durgam Cheruvu bund. Gloves and breakfast provided.', '2027-06-26 06:30+05:30', 'Durgam Cheruvu, Hyderabad'),
('c0000000-0000-4000-8000-000000000004', 'Screening camp — Hanamkonda', 'Free eye screening for anyone over fifty. Bring a family member.', '2026-10-18 08:00+05:30', 'Government High School, Hanamkonda'),
('c0000000-0000-4000-8000-000000000005', 'Vaccination drive — Bowenpally', 'Bring your street dogs. Vaccination and a meal, no questions asked.', '2026-10-25 07:00+05:30', 'Bowenpally, Secunderabad'),
('c0000000-0000-4000-8000-000000000002', 'Handpump repair training', 'A two-day course for village volunteers. Tools provided; certificate on completion.', '2026-11-21 09:00+05:30', 'Anantapur');
