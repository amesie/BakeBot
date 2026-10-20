# Translations

**Status: final.** The isiXhosa and Afrikaans text was checked and approved by native speakers on 20 October 2026 (D-072); both files are marked `FINAL`.

When new text is added, add it to `messages/en.json`, `messages/xh.json` and `messages/af.json` together and have a native speaker check the new lines before release (the unit test `tests/i18n.test.ts` fails if a language is missing a line).

Words in curly brackets such as `{order_number}`, `{name}`, `{email}` or `{reference}` are filled in by the app; keep them exactly as they are.

278 strings per language. The `email.*` strings are the customer emails (added 2026-10-20).

| Key | English | isiXhosa | Afrikaans |
|---|---|---|---|
| `nav.menu` | Menu | Imenyu | Spyskaart |
| `nav.order` | Order | Odola | Bestel |
| `nav.contact` | Contact | Qhagamshelana | Kontak |
| `nav.orderNow` | Order Now | Odola Ngoku | Bestel Nou |
| `nav.openMenu` | Open menu | Vula imenyu | Maak kieslys oop |
| `nav.closeMenu` | Close menu | Vala imenyu | Maak kieslys toe |
| `nav.language` | Language | Ulwimi | Taal |
| `nav.skipToContent` | Skip to content | Tsibela kumxholo | Spring na inhoud |
| `nav.home` | KD Pops home | Ikhaya le-KD Pops | KD Pops tuisblad |
| `hero.badge` | She's baaaaaaaaack! | Ubuyileeeeee! | Sy's teeeeeeeerug! |
| `hero.eyebrow` | Handmade happiness on a stick | Uvuyo olwenziwe ngesandla entongeni | Handgemaakte geluk op 'n stokkie |
| `hero.tagline` | Lower prices with the same quality taste! | Amaxabiso aphantsi, incasa esemgangathweni efanayo! | Laer pryse met dieselfde gehalte smaak! |
| `hero.fresh` | Freshly made to order! | Zenziwa zintsha xa uodola! | Vars gemaak op bestelling! |
| `hero.orderNow` | Order Now | Odola Ngoku | Bestel Nou |
| `hero.seeMenu` | See the Menu | Jonga iMenyu | Sien die Spyskaart |
| `hero.artLabel` | A cluster of decorated cake pops | Iqela lee-cake pops ezihonjisiweyo | 'n Klompie versierde koekpops |
| `ticker.handmade` | HANDMADE | ZENZIWE NGESANDLA | HANDGEMAAK |
| `ticker.fromPrice` | FROM R{price} | UKUSUKELA KU-R{price} | VANAF R{price} |
| `ticker.pickup` | SCHOOL PICKUP | ZILANDWA ESIKOLWENI | OPTEL BY DIE SKOOL |
| `menu.eyebrow` | Pick your favourite | Khetha oyithandayo | Kies jou gunsteling |
| `menu.title` | The Menu | IMenyu | Die Spyskaart |
| `menu.intro` | Four nostalgic flavours. One very easy choice: try them all. | Iincasa ezine ezikhumbuzayo. Ukhetho olulula kakhulu: zama zonke. | Vier nostalgiese geure. Een baie maklike keuse: probeer hulle almal. |
| `menu.perPop` | per pop | nganye | per pop |
| `menu.addToOrder` | Add to order | Yongeza kwi-odolo | Voeg by bestelling |
| `menu.addFlavour` | Add to order: {flavour} | Yongeza kwi-odolo: {flavour} | Voeg by bestelling: {flavour} |
| `menu.belgianBadge` | Made with real Belgian chocolate! | Yenziwe ngetshokolethi yokwenene yaseBelgium! | Gemaak met regte Belgiese sjokolade! |
| `menu.soldOut` | Sold out this week | Iphelile kule veki | Uitverkoop hierdie week |
| `menu.empty` | The menu is being updated. Please check back soon. | Imenyu iyahlaziywa. Nceda ubuye kungekudala. | Die spyskaart word opgedateer. Kom asseblief binnekort weer kyk. |
| `menu.illustration` | {flavour} cake pop | I-cake pop ye-{flavour} | {flavour}-koekpop |
| `order.eyebrow` | No fuss, just pops | Akukho ngxaki, zii-pops nje | Geen gesukkel nie, net pops |
| `order.title` | Place Your Order | Faka i-Odolo Yakho | Plaas Jou Bestelling |
| `footer.tagline` | Freshly made to order! | Zenziwa zintsha xa uodola! | Vars gemaak op bestelling! |
| `footer.contactLabel` | Say hello or ask us anything | Yithi molo okanye usibuze nantoni na | Sê hallo of vra ons enigiets |
| `footer.whatsapp` | WhatsApp | WhatsApp | WhatsApp |
| `footer.rights` | © {year} KD Pops. Handmade with care. | © {year} KD Pops. Zenziwe ngesandla ngononophelo. | © {year} KD Pops. Met liefde handgemaak. |
| `footer.smallBatch` | Small batch · Big joy | Iqela elincinci · Uvuyo olukhulu | Klein hoeveelhede · Groot vreugde |
| `consent.step` | Before you order | Phambi kokuba uodole | Voor jy bestel |
| `consent.intro` | A few quick checks first. | Imibuzo embalwa ekhawulezayo kuqala. | Eers 'n paar vinnige vrae. |
| `consent.bakebot` | Order updates come from BakeBot, KD Pops' automated assistant. Kaydee reads and confirms every order herself. | Uhlaziyo lwee-odolo luvela ku-BakeBot, umncedisi ozenzekelayo we-KD Pops. UKaydee ufunda aze aqinisekise yonke i-odolo ngokwakhe. | Bestellingsopdaterings kom van BakeBot, KD Pops se outomatiese assistent. Kaydee lees en bevestig self elke bestelling. |
| `consent.popiaTitle` | Your details | Iinkcukacha zakho | Jou besonderhede |
| `consent.popia` | To process your order we keep your name, cell number, language and (if you give it) your email address. Only Kaydee and her helper can see them. They are stored securely by Supabase in the EU, never used for marketing, and deleted 90 days after your last order. | Ukuze silungiselele i-odolo yakho sigcina igama lakho, inombolo yeselfowuni, ulwimi kunye (ukuba uyinikile) nedilesi yakho ye-imeyile. NguKaydee nomncedisi wakhe kuphela abanokuzibona. Zigcinwa ngokukhuselekileyo nguSupabase e-EU, azisetyenziselwa ntengiso, kwaye zicinywa kwiintsuku ezingama-90 emva kwe-odolo yakho yokugqibela. | Om jou bestelling te verwerk, hou ons jou naam, selnommer, taal en (as jy dit gee) jou e-posadres. Net Kaydee en haar helper kan dit sien. Dit word veilig deur Supabase in die EU gestoor, nooit vir bemarking gebruik nie, en 90 dae na jou laaste bestelling uitgevee. |
| `consent.agree` | I agree to KD Pops using my details for my order | Ndiyavuma ukuba i-KD Pops isebenzise iinkcukacha zam kwi-odolo yam | Ek stem in dat KD Pops my besonderhede vir my bestelling gebruik |
| `consent.under18` | Are you under 18? | Ingaba ungaphantsi kweminyaka eli-18? | Is jy jonger as 18? |
| `consent.yes` | Yes | Ewe | Ja |
| `consent.no` | No | Hayi | Nee |
| `consent.guardian` | My parent or guardian says it's OK for me to order | Umzali okanye umgcini wam uthi ndingaodola | My ouer of voog sê ek mag bestel |
| `consent.continue` | Continue | Qhubeka | Gaan voort |
| `consent.dontAgree` | I don't agree | Andivumi | Ek stem nie in nie |
| `consent.declined` | No problem. Nothing has been saved. You can still order by sending Kaydee a WhatsApp. | Akukho ngxaki. Akukho nto igciniweyo. Usenako ukuodola ngokuthumela uKaydee umyalezo we-WhatsApp. | Geen probleem nie. Niks is gestoor nie. Jy kan steeds bestel deur vir Kaydee 'n WhatsApp te stuur. |
| `consent.guardianNeeded` | Please ask a parent or guardian first. Nothing has been saved. You can also order through Kaydee on WhatsApp. | Nceda ubuze umzali okanye umgcini kuqala. Akukho nto igciniweyo. Ungaodola nangoKaydee kwi-WhatsApp. | Vra asseblief eers 'n ouer of voog. Niks is gestoor nie. Jy kan ook deur Kaydee op WhatsApp bestel. |
| `consent.back` | Back | Buyela umva | Terug |
| `form.step` | Build your box | Yakha ibhokisi yakho | Bou jou boks |
| `form.hint` | Choose your flavours and how many you'd like. | Khetha iincasa zakho kunye nobungakanani obufunayo. | Kies jou geure en hoeveel jy wil hê. |
| `form.flavour` | Flavour | Incasa | Geur |
| `form.quantity` | Quantity | Ubungakanani | Hoeveelheid |
| `form.remove` | Remove {flavour} | Susa i-{flavour} | Verwyder {flavour} |
| `form.addRow` | Add another flavour | Yongeza enye incasa | Voeg nog 'n geur by |
| `form.day` | Collection day | Usuku lokulanda | Afhaaldag |
| `form.chooseDay` | Choose a day | Khetha usuku | Kies 'n dag |
| `form.slot` | Collection time | Ixesha lokulanda | Afhaaltyd |
| `form.payment` | Payment method | Indlela yokuhlawula | Betaalmetode |
| `form.name` | Full name | Igama elipheleleyo | Volle naam |
| `form.namePlaceholder` | Your name | Igama lakho | Jou naam |
| `form.phone` | Cell number | Inombolo yeselfowuni | Selnommer |
| `form.phonePlaceholder` | e.g. 082 123 4567 | umz. 082 123 4567 | bv. 082 123 4567 |
| `form.notes` | Notes or allergies | Amanqaku okanye ii-aleji | Notas of allergieë |
| `form.optional` | Optional | Ukuzikhethela | Opsioneel |
| `form.notesPlaceholder` | Anything we should know? | Ikhona into ekufuneka siyazi? | Enigiets wat ons moet weet? |
| `form.review` | Review order | Jonga i-odolo | Hersien bestelling |
| `form.largeNote` | More than {threshold} pops? Kaydee will send you a personal quote. | Ngaphezulu kwee-pops ezi-{threshold}? UKaydee uza kukuthumelela ikowuteshini yakho. | Meer as {threshold} pops? Kaydee sal vir jou 'n persoonlike kwotasie stuur. |
| `form.cutoff` | Pre-orders for next week close on Thursday at 20:00. | Ii-odolo zeveki ezayo zivalwa ngoLwesine ngo-20:00. | Voorafbestellings vir volgende week sluit Donderdag om 20:00. |
| `form.errorSummary` | Please fix the following: | Nceda ulungise oku kulandelayo: | Maak asseblief die volgende reg: |
| `form.email` | Email | I-imeyile | E-pos |
| `form.emailPlaceholder` | you@example.com | wena@umzekelo.com | jy@voorbeeld.com |
| `form.emailHint` | Optional. We'll email your order details, invoice and updates. | Ukuzikhethela. Siza kukuthumelela iinkcukacha ze-odolo, i-invoyisi kunye nohlaziyo nge-imeyile. | Opsioneel. Ons e-pos jou bestellingbesonderhede, faktuur en opdaterings. |
| `summary.eyebrow` | Your picks | Okukhethileyo | Jou keuses |
| `summary.pops` | {count} pops | ii-pops ezi-{count} | {count} pops |
| `summary.title` | Order Summary | Isishwankathelo se-Odolo | Bestellingsopsomming |
| `summary.empty` | Add a flavour to get started. | Yongeza incasa ukuze uqalise. | Voeg 'n geur by om te begin. |
| `summary.total` | Total | Iyonke | Totaal |
| `summary.note` | No account needed. | Akufuneki akhawunti. | Geen rekening nodig nie. |
| `summary.payNote` | Pay cash when you collect, or by EFT once Kaydee confirms. | Hlawula ngemali xa ulanda, okanye nge-EFT xa uKaydee eqinisekisile. | Betaal kontant wanneer jy afhaal, of per EFT sodra Kaydee bevestig. |
| `review.step` | Check your order | Jonga i-odolo yakho | Kontroleer jou bestelling |
| `review.hint` | Make sure everything looks right. | Qinisekisa ukuba yonke into ichanekile. | Maak seker alles lyk reg. |
| `review.collection` | Collection | Ukulanda | Afhaal |
| `review.payment` | Payment | Intlawulo | Betaling |
| `review.contact` | Your details | Iinkcukacha zakho | Jou besonderhede |
| `review.edit` | Edit | Hlela | Wysig |
| `review.place` | Place Order | Faka i-Odolo | Plaas Bestelling |
| `review.placing` | Placing your order... | I-odolo yakho iyafakwa... | Jou bestelling word geplaas... |
| `done.eyebrow` | Order received | I-odolo ifunyenwe | Bestelling ontvang |
| `done.title` | Thank you! Your order is in. | Enkosi! I-odolo yakho ingenile. | Dankie! Jou bestelling is in. |
| `done.pending` | Kaydee will confirm after school. We'll keep you posted, {name}. | UKaydee uza kuqinisekisa emva kwesikolo. Siza kukwazisa, {name}. | Kaydee sal na skool bevestig. Ons hou jou op hoogte, {name}. |
| `done.waitlisted` | This week is full, so you're on the waitlist, {name}. Kaydee will let you know if a spot opens up. | Le veki igcwele, ngoko ukuluhlu lokulinda, {name}. UKaydee uza kukwazisa ukuba kukho indawo evulekileyo. | Hierdie week is vol, so jy is op die waglys, {name}. Kaydee sal jou laat weet as daar plek oopkom. |
| `done.quote` | Big order! Kaydee will send you a quote after school, {name}. | I-odolo enkulu! UKaydee uza kukuthumelela ikowuteshini emva kwesikolo, {name}. | Groot bestelling! Kaydee sal na skool vir jou 'n kwotasie stuur, {name}. |
| `done.number` | Order number | Inombolo ye-odolo | Bestellingnommer |
| `done.statusLink` | View order status | Jonga imeko ye-odolo | Sien bestellingstatus |
| `done.copy` | Copy link | Kopa ikhonkco | Kopieer skakel |
| `done.copied` | Link copied | Ikhonkco likopiwe | Skakel gekopieer |
| `done.saveLink` | Save this link to check your order later. | Gcina eli khonkco ukuze ujonge i-odolo yakho kamva. | Stoor hierdie skakel om later jou bestelling na te gaan. |
| `done.another` | Place another order | Faka enye i-odolo | Plaas nog 'n bestelling |
| `queued.title` | Saved on your phone | Igcinwe kwifowuni yakho | Op jou foon gestoor |
| `queued.body` | You're offline. Your order is saved and will be sent automatically when you're back online. Please keep this page open. | Awukho kwi-intanethi. I-odolo yakho igciniwe kwaye iza kuthunyelwa ngokuzenzekelayo xa ubuyela kwi-intanethi. Nceda ushiye eli phepha livuliwe. | Jy is vanlyn. Jou bestelling is gestoor en sal outomaties gestuur word sodra jy weer aanlyn is. Hou asseblief hierdie bladsy oop. |
| `queued.retrying` | Trying to send your order... | Sizama ukuthumela i-odolo yakho... | Probeer jou bestelling stuur... |
| `queued.failed` | We couldn't send your order yet. We'll try again when you're back online, or you can WhatsApp Kaydee. | Asikakwazi ukuthumela i-odolo yakho. Siza kuzama kwakhona xa ubuyela kwi-intanethi, okanye ungathumela uKaydee kwi-WhatsApp. | Ons kon nog nie jou bestelling stuur nie. Ons probeer weer wanneer jy weer aanlyn is, of jy kan vir Kaydee WhatsApp. |
| `errors.required` | Required | Iyafuneka | Verpligtend |
| `errors.invalid` | Please check this | Nceda ujonge oku | Kontroleer asseblief |
| `errors.too_long` | Too long | Inde kakhulu | Te lank |
| `errors.too_many` | That's more than we can make of one flavour | Zininzi kakhulu kunezo sinokuzenza zencasa enye | Dis meer as wat ons van een geur kan maak |
| `errors.unavailable` | One of these flavours is no longer available | Enye yezi ncasa ayisafumaneki | Een van hierdie geure is nie meer beskikbaar nie |
| `errors.closed` | That day is no longer open for orders. Please choose another. | Olo suku alusavulekanga kwii-odolo. Nceda ukhethe olunye. | Daardie dag is nie meer oop vir bestellings nie. Kies asseblief 'n ander dag. |
| `errors.conflict` | Something went wrong. Please start a new order. | Kukho into engahambanga kakuhle. Nceda uqalise i-odolo entsha. | Iets het skeefgeloop. Begin asseblief 'n nuwe bestelling. |
| `errors.phoneInvalid` | Enter a South African cell number, e.g. 082 123 4567 | Faka inombolo yeselfowuni yaseMzantsi Afrika, umz. 082 123 4567 | Tik 'n Suid-Afrikaanse selnommer in, bv. 082 123 4567 |
| `errors.generic` | Something went wrong. Please try again. | Kukho into engahambanga kakuhle. Nceda uzame kwakhona. | Iets het skeefgeloop. Probeer asseblief weer. |
| `errors.fields.full_name` | Full name | Igama elipheleleyo | Volle naam |
| `errors.fields.phone` | Cell number | Inombolo yeselfowuni | Selnommer |
| `errors.fields.items` | Flavours and quantities | Iincasa nobungakanani | Geure en hoeveelhede |
| `errors.fields.collection_date` | Collection day | Usuku lokulanda | Afhaaldag |
| `errors.fields.collection_slot` | Collection time | Ixesha lokulanda | Afhaaltyd |
| `errors.fields.payment_method` | Payment method | Indlela yokuhlawula | Betaalmetode |
| `errors.fields.special_notes` | Notes | Amanqaku | Notas |
| `errors.fields.consent_given` | Consent | Imvume | Toestemming |
| `errors.fields.guardian_consent` | Guardian consent | Imvume yomzali okanye yomgcini | Toestemming van ouer of voog |
| `errors.fields.is_minor` | Age question | Umbuzo weminyaka | Ouderdomsvraag |
| `errors.fields.order_id` | Order | I-odolo | Bestelling |
| `errors.fields.access_token` | Order | I-odolo | Bestelling |
| `errors.fields.form` | Order | I-odolo | Bestelling |
| `errors.fields.email` | Email | I-imeyile | E-pos |
| `errors.emailInvalid` | Please check your email address, e.g. you@example.com | Nceda ujonge idilesi yakho ye-imeyile, umz. wena@umzekelo.com | Kontroleer asseblief jou e-posadres, bv. jy@voorbeeld.com |
| `slots.second_break` | 2nd break · 11:45–12:00 | Ikhefu lesi-2 · 11:45–12:00 | 2de pouse · 11:45–12:00 |
| `slots.after_school` | After school · 14:30–15:00 | Emva kwesikolo · 14:30–15:00 | Na skool · 14:30–15:00 |
| `payment.cash` | Cash on collection | Imali xa ulanda | Kontant by afhaal |
| `payment.eft` | EFT | EFT | EFT |
| `days.1` | Monday | uMvulo | Maandag |
| `days.2` | Tuesday | uLwesibini | Dinsdag |
| `days.3` | Wednesday | uLwesithathu | Woensdag |
| `days.4` | Thursday | uLwesine | Donderdag |
| `days.5` | Friday | uLwesihlanu | Vrydag |
| `days.6` | Saturday | uMgqibelo | Saterdag |
| `days.7` | Sunday | iCawa | Sondag |
| `months.1` | January | kaJanuwari | Januarie |
| `months.2` | February | kaFebruwari | Februarie |
| `months.3` | March | kaMatshi | Maart |
| `months.4` | April | ka-Epreli | April |
| `months.5` | May | kaMeyi | Mei |
| `months.6` | June | kaJuni | Junie |
| `months.7` | July | kaJulayi | Julie |
| `months.8` | August | ka-Agasti | Augustus |
| `months.9` | September | kaSeptemba | September |
| `months.10` | October | ka-Okthobha | Oktober |
| `months.11` | November | kaNovemba | November |
| `months.12` | December | kaDisemba | Desember |
| `status.title` | Your order | I-odolo yakho | Jou bestelling |
| `status.loading` | Loading your order... | I-odolo yakho iyalayishwa... | Jou bestelling word gelaai... |
| `status.notFound` | We couldn't find that order. Check that you opened the full link. | Asikwazanga ukuyifumana loo odolo. Qinisekisa ukuba uvule ikhonkco elipheleleyo. | Ons kon nie daardie bestelling vind nie. Maak seker jy het die volledige skakel oopgemaak. |
| `status.unavailable` | We can't load your order right now. Please try again in a minute. | Asikwazi ukulayisha i-odolo yakho ngoku. Nceda uzame kwakhona emva komzuzu. | Ons kan nie nou jou bestelling laai nie. Probeer asseblief oor 'n minuut weer. |
| `status.hello` | Hi {name} | Molo {name} | Hallo {name} |
| `status.items` | Your pops | Ii-pops zakho | Jou pops |
| `status.total` | Total | Iyonke | Totaal |
| `status.quoteWaiting` | Kaydee will send you a quote. | UKaydee uza kukuthumelela ikowuteshini. | Kaydee sal vir jou 'n kwotasie stuur. |
| `status.collection` | Collection | Ukulanda | Afhaal |
| `status.revised` | New collection date | Umhla omtsha wokulanda | Nuwe afhaaldatum |
| `status.place` | Where | Phi | Waar |
| `status.payment` | Payment | Intlawulo | Betaling |
| `status.reference` | Payment reference | Isalathiso sentlawulo | Betalingsverwysing |
| `status.useReference` | Use this reference when you pay by EFT. | Sebenzisa esi salathiso xa uhlawula nge-EFT. | Gebruik hierdie verwysing wanneer jy per EFT betaal. |
| `status.bank` | Bank details | Iinkcukacha zebhanki | Bankbesonderhede |
| `status.updates` | Updates | Uhlaziyo | Opdaterings |
| `status.talk` | Talk to Kaydee | Thetha noKaydee | Praat met Kaydee |
| `status.phone` | Cell | Iselfowuni | Sel |
| `status.backHome` | Back to KD Pops | Buyela kwi-KD Pops | Terug na KD Pops |
| `status.progress` | Order progress | Inkqubela ye-odolo | Bestellingsvordering |
| `status.steps.pending` | Received | Ifunyenwe | Ontvang |
| `status.steps.confirmed` | Confirmed | Iqinisekisiwe | Bevestig |
| `status.steps.baking` | Baking | Iyabhakwa | Word gebak |
| `status.steps.ready` | Ready | Ilungile | Gereed |
| `status.steps.collected` | Collected | Ilandiwe | Afgehaal |
| `status.label.waitlisted` | On the waitlist | Kuluhlu lokulinda | Op die waglys |
| `status.label.pending` | Waiting for Kaydee | Ilinde uKaydee | Wag vir Kaydee |
| `status.label.confirmed` | Confirmed | Iqinisekisiwe | Bevestig |
| `status.label.baking` | Baking | Iyabhakwa | Word gebak |
| `status.label.ready` | Ready to collect | Ilungele ukulandwa | Gereed om af te haal |
| `status.label.collected` | Collected | Ilandiwe | Afgehaal |
| `status.label.cancelled` | Cancelled | Irhoxisiwe | Gekanselleer |
| `status.paymentLabel.unpaid` | Not paid yet | Ayikahlawulwa | Nog nie betaal nie |
| `status.paymentLabel.pending_review` | Proof received, being checked | Ubungqina bufunyenwe, buyajongwa | Bewys ontvang, word nagegaan |
| `status.paymentLabel.paid` | Paid | Ihlawulwe | Betaal |
| `status.proofTitle` | Paid by EFT? Send your proof of payment | Uhlawule nge-EFT? Thumela ubungqina bentlawulo | Per EFT betaal? Stuur jou bewys van betaling |
| `status.proofHint` | A screenshot or PDF from your banking app. Photos are made smaller first to save data. | Iskrini okanye i-PDF evela kwi-app yakho yebhanki. Iifoto zenziwa zincinci kuqala ukonga idatha. | 'n Skermskoot of PDF van jou bankprogram. Foto's word eers kleiner gemaak om data te spaar. |
| `status.proofFile` | Proof of payment | Ubungqina bentlawulo | Bewys van betaling |
| `status.proofSend` | Send proof | Thumela ubungqina | Stuur bewys |
| `status.proofSending` | Sending... | Iyathunyelwa... | Word gestuur... |
| `status.proofDone` | Thank you! Kaydee will check it and mark your order as paid. | Enkosi! UKaydee uza kubujonga aze aphawule i-odolo yakho njengehlawulweyo. | Dankie! Kaydee sal dit nagaan en jou bestelling as betaal merk. |
| `status.proofAgain` | Sent the wrong file? You can send another one. | Uthumele ifayile engeyiyo? Ungathumela enye. | Verkeerde lêer gestuur? Jy kan nog een stuur. |
| `status.proofTooLarge` | That file is too big. Please choose one under 4 MB. | Loo fayile inkulu kakhulu. Nceda ukhethe engaphantsi kwe-4 MB. | Daardie lêer is te groot. Kies asseblief een kleiner as 4 MB. |
| `status.proofBadType` | Please choose a photo, screenshot or PDF. | Nceda ukhethe ifoto, iskrini okanye i-PDF. | Kies asseblief 'n foto, skermskoot of PDF. |
| `status.proofPaid` | This order is already paid. Thank you! | Le odolo sele ihlawulwe. Enkosi! | Hierdie bestelling is reeds betaal. Dankie! |
| `status.proofFailed` | We couldn't send it. Please try again. | Asikwazanga ukuyithumela. Nceda uzame kwakhona. | Ons kon dit nie stuur nie. Probeer asseblief weer. |
| `status.invoice` | Download invoice | Khuphela i-invoyisi | Laai faktuur af |
| `status.feedbackTitle` | How were your pops? | Zibe njani ii-pops zakho? | Hoe was jou pops? |
| `status.feedbackScale` | 1 = not great, 5 = amazing | 1 = azilunganga, 5 = zimnandi kakhulu | 1 = nie goed nie, 5 = fantasties |
| `status.feedbackOverall` | Overall | Iyonke | Algeheel |
| `status.feedbackTaste` | Taste | Incasa | Smaak |
| `status.feedbackSize` | Size | Ubungakanani | Grootte |
| `status.feedbackPrice` | Price | Ixabiso | Prys |
| `status.feedbackComment` | Anything else? (optional) | Ikhona enye into? (ukuzikhethela) | Nog iets? (opsioneel) |
| `status.feedbackSend` | Send feedback | Thumela izimvo | Stuur terugvoer |
| `status.feedbackThanks` | Thank you! Kaydee reads every one. | Enkosi! UKaydee ufunda zonke. | Dankie! Kaydee lees elkeen. |
| `status.feedbackFailed` | We couldn't send your feedback. Please try again. | Asikwazanga ukuthumela izimvo zakho. Nceda uzame kwakhona. | Ons kon nie jou terugvoer stuur nie. Probeer asseblief weer. |
| `status.proofEmail` | Or email it to {email} with {reference} as the subject. | Okanye uyithumele nge-imeyile ku-{email} ne-{reference} njengesihloko. | Of e-pos dit na {email} met {reference} as die onderwerp. |
| `status.cancel` | Cancel order | Rhoxisa i-odolo | Kanselleer bestelling |
| `status.cancelConfirm` | Cancel order {order_number}? This can't be undone. | Rhoxisa i-odolo {order_number}? Oku akunakubuyiselwa umva. | Kanselleer bestelling {order_number}? Dit kan nie ontdoen word nie. |
| `status.cancelYes` | Yes, cancel it | Ewe, yirhoxise | Ja, kanselleer dit |
| `status.cancelNo` | Keep my order | Gcina i-odolo yam | Hou my bestelling |
| `status.cancelDone` | Your order is cancelled. Nothing is owed. | I-odolo yakho irhoxisiwe. Akukho nto ityalwayo. | Jou bestelling is gekanselleer. Jy skuld niks. |
| `status.cancelTooLate` | Baking has started, so this order can't be cancelled online. Please talk to Kaydee. | Ukubhaka sele kuqalile, ngoko le odolo ayinakurhoxiswa kwi-intanethi. Nceda uthethe noKaydee. | Die bak het reeds begin, so hierdie bestelling kan nie aanlyn gekanselleer word nie. Praat asseblief met Kaydee. |
| `status.cancelPaid` | You've already sent payment, so please talk to Kaydee to cancel. | Sele uhlawule, ngoko nceda uthethe noKaydee ukuze urhoxise. | Jy het reeds betaal, so praat asseblief met Kaydee om te kanselleer. |
| `status.cancelFailed` | We couldn't cancel it just now. Please try again or talk to Kaydee. | Asikwazanga ukuyirhoxisa ngoku. Nceda uzame kwakhona okanye uthethe noKaydee. | Ons kon dit nie nou kanselleer nie. Probeer asseblief weer of praat met Kaydee. |
| `templates.acknowledgement` | Order {order_number} received – Kaydee will confirm after school. | I-odolo {order_number} ifunyenwe – uKaydee uza kuqinisekisa emva kwesikolo. | Bestelling {order_number} ontvang – Kaydee sal na skool bevestig. |
| `templates.waitlisted` | Order {order_number} is on the waitlist because this week is full. Kaydee will let you know if a spot opens. | I-odolo {order_number} ikuluhlu lokulinda kuba le veki igcwele. UKaydee uza kukwazisa ukuba kukho indawo evulekileyo. | Bestelling {order_number} is op die waglys omdat hierdie week vol is. Kaydee sal jou laat weet as daar plek oopkom. |
| `templates.quote_pending` | Order {order_number} received. It's a big one, so Kaydee will send you a quote after school. | I-odolo {order_number} ifunyenwe. Inkulu, ngoko uKaydee uza kukuthumelela ikowuteshini emva kwesikolo. | Bestelling {order_number} ontvang. Dis 'n groot een, so Kaydee sal na skool vir jou 'n kwotasie stuur. |
| `templates.confirmation_cash` | Order {order_number} is confirmed! Collect it on {date}, {slot}, at {place}. Please bring {amount} in cash. | I-odolo {order_number} iqinisekisiwe! Yilande ngo-{date}, {slot}, e-{place}. Nceda uze ne-{amount} ngemali. | Bestelling {order_number} is bevestig! Haal dit af op {date}, {slot}, by {place}. Bring asseblief {amount} kontant. |
| `templates.confirmation_eft` | Order {order_number} is confirmed! Collect it on {date}, {slot}, at {place}. Please pay {amount} by EFT using reference {reference}. Send your proof of payment to {email} with {reference} as the subject, or upload it on your order page. | I-odolo {order_number} iqinisekisiwe! Yilande ngo-{date}, {slot}, e-{place}. Nceda uhlawule i-{amount} nge-EFT usebenzisa isalathiso {reference}. Thumela ubungqina bentlawulo ku-{email} ne-{reference} njengesihloko, okanye ubulayishe kwiphepha le-odolo yakho. | Bestelling {order_number} is bevestig! Haal dit af op {date}, {slot}, by {place}. Betaal asseblief {amount} per EFT met verwysing {reference}. Stuur jou bewys van betaling na {email} met {reference} as die onderwerp, of laai dit op jou bestellingsblad op. |
| `templates.declined` | Sorry, KD Pops can't take order {order_number} this time. Nothing is owed. Thank you for understanding. | Uxolo, i-KD Pops ayinakuyithatha i-odolo {order_number} ngeli xesha. Akukho nto ityalwayo. Enkosi ngokuqonda. | Jammer, KD Pops kan nie hierdie keer bestelling {order_number} aanvaar nie. Jy skuld niks. Dankie vir jou begrip. |
| `templates.payment_received` | Payment for order {order_number} received. Thank you! | Intlawulo ye-odolo {order_number} ifunyenwe. Enkosi! | Betaling vir bestelling {order_number} ontvang. Dankie! |
| `templates.ready` | Order {order_number} is ready! Collect it on {date}, {slot}, at {place}. | I-odolo {order_number} ilungile! Yilande ngo-{date}, {slot}, e-{place}. | Bestelling {order_number} is gereed! Haal dit af op {date}, {slot}, by {place}. |
| `templates.delayed` | Sorry, order {order_number} is delayed. Your new collection day is {date}. | Uxolo, i-odolo {order_number} ilibazisekile. Usuku lwakho olutsha lokulanda ngu-{date}. | Jammer, bestelling {order_number} is vertraag. Jou nuwe afhaaldag is {date}. |
| `templates.proof_received` | We received your proof of payment for order {order_number}. Kaydee will check it soon. | Sibufumene ubungqina bakho bentlawulo be-odolo {order_number}. UKaydee uza kubujonga kungekudala. | Ons het jou bewys van betaling vir bestelling {order_number} ontvang. Kaydee sal dit binnekort nagaan. |
| `templates.proof_rejected` | We couldn't match the proof of payment for order {order_number}. Please check the amount and reference, then send it again. | Asikwazanga ukubudibanisa ubungqina bentlawulo be-odolo {order_number}. Nceda ujonge isixa nesalathiso, uze ubuthumele kwakhona. | Ons kon nie die bewys van betaling vir bestelling {order_number} laat klop nie. Kontroleer asseblief die bedrag en verwysing en stuur dit weer. |
| `templates.invoice_link` | Your invoice: {url} | I-invoyisi yakho: {url} | Jou faktuur: {url} |
| `templates.signature` | BakeBot (KD Pops) | BakeBot (KD Pops) | BakeBot (KD Pops) |
| `templates.payment_reminder` | Friendly reminder from BakeBot: order {order_number} is not paid yet. Please pay {amount} by EFT using reference {reference} before {date}. Already paid? Email your proof to {email} with {reference} as the subject. | Isikhumbuzo esinobubele esivela ku-BakeBot: i-odolo {order_number} ayikahlawulwa. Nceda uhlawule i-{amount} nge-EFT usebenzisa isalathiso {reference} phambi ko-{date}. Sele uhlawule? Thumela ubungqina bakho nge-imeyile ku-{email} ne-{reference} njengesihloko. | Vriendelike herinnering van BakeBot: bestelling {order_number} is nog nie betaal nie. Betaal asseblief {amount} per EFT met verwysing {reference} voor {date}. Reeds betaal? E-pos jou bewys na {email} met {reference} as die onderwerp. |
| `templates.released` | Order {order_number} was not paid in time, so the pops have been released for sale. If this is a mistake, please talk to Kaydee. | I-odolo {order_number} ayihlawulwanga ngexesha, ngoko ii-pops zikhutshelwe ukuthengiswa. Ukuba yimpazamo le, nceda uthethe noKaydee. | Bestelling {order_number} is nie betyds betaal nie, so die pops is vir verkoop vrygestel. As dit 'n fout is, praat asseblief met Kaydee. |
| `templates.collect_reminder` | Your paid order {order_number} is still waiting for you. Please talk to Kaydee to arrange collection. | I-odolo yakho ehlawulweyo {order_number} isakulindile. Nceda uthethe noKaydee ukuze uyilande. | Jou betaalde bestelling {order_number} wag nog vir jou. Praat asseblief met Kaydee om dit af te haal. |
| `templates.feedback_request` | Thank you for collecting order {order_number}! How were your pops? Leave quick feedback below. | Enkosi ngokulanda i-odolo {order_number}! Zibe njani ii-pops zakho? Shiya izimvo ezimfutshane apha ngezantsi. | Dankie dat jy bestelling {order_number} afgehaal het! Hoe was jou pops? Laat vinnig terugvoer hieronder. |
| `templates.cancelled_by_customer` | You cancelled order {order_number}. Nothing is owed. | Urhoxise i-odolo {order_number}. Akukho nto ityalwayo. | Jy het bestelling {order_number} gekanselleer. Jy skuld niks. |
| `myOrders.title` | Your recent orders | Ii-odolo zakho zakutsha nje | Jou onlangse bestellings |
| `myOrders.open` | Open | Vula | Maak oop |
| `chat.open` | Ask BakeBot | Buza uBakeBot | Vra BakeBot |
| `chat.title` | BakeBot | BakeBot | BakeBot |
| `chat.disclosure` | Hi! I'm BakeBot, KD Pops' automated assistant (not a person). I answer questions about the menu, prices, ordering and collection using answers Kaydee has approved. For anything else, tap "Talk to Kaydee". | Molo! NdinguBakeBot, umncedisi ozenzekelayo we-KD Pops (andingomntu). Ndiphendula imibuzo malunga nemenyu, amaxabiso, ukuodola nokulanda ndisebenzisa iimpendulo ezivunywe nguKaydee. Kwenye into, cofa u-"Thetha noKaydee". | Hallo! Ek is BakeBot, KD Pops se outomatiese assistent (nie 'n mens nie). Ek beantwoord vrae oor die spyskaart, pryse, bestel en afhaal met antwoorde wat Kaydee goedgekeur het. Vir enigiets anders, tik "Praat met Kaydee". |
| `chat.placeholder` | Type your question | Bhala umbuzo wakho | Tik jou vraag |
| `chat.send` | Send | Thumela | Stuur |
| `chat.close` | Close chat | Vala incoko | Maak klets toe |
| `chat.talk` | Talk to Kaydee | Thetha noKaydee | Praat met Kaydee |
| `chat.thinking` | BakeBot is typing... | UBakeBot uyabhala... | BakeBot tik... |
| `chat.checkWithKaydee` | I'm not sure about that one, so I'll check with Kaydee. | Andiqinisekanga ngaloo nto, ngoko ndiza kubuza uKaydee. | Ek is nie seker daaroor nie, so ek sal by Kaydee hoor. |
| `chat.handover` | I've passed your question to Kaydee. She's in class during the day and usually replies after school (from about 15:00). | Ndiwudlulisele umbuzo wakho kuKaydee. Usegumbini lokufundela emini kwaye uqhele ukuphendula emva kwesikolo (ukusuka malunga no-15:00). | Ek het jou vraag aan Kaydee gegee. Sy is bedags in die klas en antwoord gewoonlik na skool (vanaf omtrent 15:00). |
| `chat.contactPrompt` | Leave your name and cell number so Kaydee can reply on WhatsApp: | Shiya igama lakho nenombolo yeselfowuni ukuze uKaydee aphendule kwi-WhatsApp: | Los jou naam en selnommer sodat Kaydee op WhatsApp kan antwoord: |
| `chat.contactName` | Your name | Igama lakho | Jou naam |
| `chat.contactPhone` | Cell number | Inombolo yeselfowuni | Selnommer |
| `chat.contactSave` | Send to Kaydee | Thumela kuKaydee | Stuur na Kaydee |
| `chat.contactThanks` | Thank you! Kaydee will reply on WhatsApp after school. | Enkosi! UKaydee uza kuphendula kwi-WhatsApp emva kwesikolo. | Dankie! Kaydee sal na skool op WhatsApp antwoord. |
| `chat.fallback` | BakeBot can't answer right now, so here's the order form. You can also WhatsApp Kaydee. | UBakeBot akakwazi ukuphendula ngoku, ngoko nantsi ifomu yokuodola. Ungathumela noKaydee kwi-WhatsApp. | BakeBot kan nie nou antwoord nie, so hier is die bestelvorm. Jy kan ook vir Kaydee WhatsApp. |
| `chat.error` | Something went wrong. Please try again. | Kukho into engahambanga kakuhle. Nceda uzame kwakhona. | Iets het skeefgeloop. Probeer asseblief weer. |
| `chat.limit` | This chat is getting long. Please talk to Kaydee or use the order form. | Le ncoko iyaba nde. Nceda uthethe noKaydee okanye usebenzise ifomu yokuodola. | Hierdie klets raak lank. Praat asseblief met Kaydee of gebruik die bestelvorm. |
| `chat.you` | You | Wena | Jy |
| `email.receivedSubject` | KD Pops order {order_number} received | I-odolo ye-KD Pops {order_number} ifunyenwe | KD Pops-bestelling {order_number} ontvang |
| `email.receivedHeading` | Thanks {name}! Your order is in. | Enkosi {name}! I-odolo yakho ingenile. | Dankie {name}! Jou bestelling is in. |
| `email.receivedIntro` | Kaydee will confirm after school. Here are your order details. | UKaydee uza kuqinisekisa emva kwesikolo. Nazi iinkcukacha ze-odolo yakho. | Kaydee sal na skool bevestig. Hier is jou bestellingbesonderhede. |
| `email.items` | Your pops | Ii-pops zakho | Jou pops |
| `email.total` | Total | Iyonke | Totaal |
| `email.quote` | Kaydee will send you a quote for this large order. | UKaydee uza kukuthumelela ikowuteshini yale odolo inkulu. | Kaydee sal vir jou 'n kwotasie vir hierdie groot bestelling stuur. |
| `email.collection` | Collection | Ukulanda | Afhaal |
| `email.payment` | Payment | Intlawulo | Betaling |
| `email.track` | Track your order | Landela i-odolo yakho | Volg jou bestelling |
| `email.cancel` | Cancel my order | Rhoxisa i-odolo yam | Kanselleer my bestelling |
| `email.cancelNote` | Changed your mind? You can cancel until baking starts. | Utshintshe ingqondo? Ungarhoxisa de kuqale ukubhaka. | Van plan verander? Jy kan kanselleer totdat die bak begin. |
| `email.keepLink` | Keep this email: the buttons above are your private link to this order. | Gcina le imeyile: amaqhosha angentla likhonkco lakho labucala kule odolo. | Hou hierdie e-pos: die knoppies hierbo is jou privaat skakel na hierdie bestelling. |
| `email.invoiceSubject` | KD Pops order {order_number} confirmed – invoice {reference} | I-odolo ye-KD Pops {order_number} iqinisekisiwe – i-invoyisi {reference} | KD Pops-bestelling {order_number} bevestig – faktuur {reference} |
| `email.invoiceHeading` | Your order is confirmed! | I-odolo yakho iqinisekisiwe! | Jou bestelling is bevestig! |
| `email.invoiceAttached` | Your invoice is attached. You can also open it here: | I-invoyisi yakho incamathelisiwe. Ungayivula naapha: | Jou faktuur is aangeheg. Jy kan dit ook hier oopmaak: |
| `email.openInvoice` | Open invoice | Vula i-invoyisi | Maak faktuur oop |
| `email.readySubject` | Your KD Pops order {order_number} is ready! | I-odolo yakho ye-KD Pops {order_number} ilungile! | Jou KD Pops-bestelling {order_number} is gereed! |
| `email.readyHeading` | Your pops are ready! | Ii-pops zakho zilungile! | Jou pops is gereed! |
| `email.cancelledSubject` | KD Pops order {order_number} cancelled | I-odolo ye-KD Pops {order_number} irhoxisiwe | KD Pops-bestelling {order_number} gekanselleer |
| `email.cancelledHeading` | Your order is cancelled | I-odolo yakho irhoxisiwe | Jou bestelling is gekanselleer |
| `email.footer` | Sent by BakeBot, KD Pops' automated assistant, because you placed an order with KD Pops. Questions? WhatsApp Kaydee on {phone}. | Ithunyelwe nguBakeBot, umncedisi ozenzekelayo we-KD Pops, kuba uodole kwi-KD Pops. Imibuzo? Thumela uKaydee kwi-WhatsApp ku-{phone}. | Gestuur deur BakeBot, KD Pops se outomatiese assistent, omdat jy by KD Pops bestel het. Vrae? WhatsApp Kaydee by {phone}. |
