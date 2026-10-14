# Translations to review

The spec (7.9) says machine-drafted isiXhosa and Afrikaans must not ship as final. These are first drafts written by Claude Code.
A fluent speaker should check each line, edit `messages/xh.json` or `messages/af.json`, and when a file is fully checked change its `meta.status` from `NEEDS_REVIEW` to `FINAL` (the test in `tests/i18n.test.ts` will then need its review check updated).

`{price}`, `{flavour}` and `{year}` are filled in by the app; keep them exactly as they are.

| Key | English | isiXhosa (draft) | Afrikaans (draft) |
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
| `menu.addFlavour` | Add {flavour} to your order | Yongeza i-{flavour} kwi-odolo yakho | Voeg {flavour} by jou bestelling |
| `menu.belgianBadge` | Made with real Belgian chocolate! | Yenziwe ngetshokolethi yokwenene yaseBelgium! | Gemaak met regte Belgiese sjokolade! |
| `menu.soldOut` | Sold out this week | Iphelile kule veki | Uitverkoop hierdie week |
| `menu.empty` | The menu is being updated. Please check back soon. | Imenyu iyahlaziywa. Nceda ubuye kungekudala. | Die spyskaart word opgedateer. Kom asseblief binnekort weer kyk. |
| `menu.illustration` | {flavour} cake pop | I-cake pop ye-{flavour} | {flavour}-koekpop |
| `order.eyebrow` | No fuss, just pops | Akukho ngxaki, zii-pops nje | Geen gesukkel nie, net pops |
| `order.title` | Place Your Order | Faka i-Odolo Yakho | Plaas Jou Bestelling |
| `order.comingSoon` | Online ordering opens soon. Until then, send Kaydee a WhatsApp to order. | Ukuodola kwi-intanethi kuza kuvulwa kungekudala. Okwangoku, thumela uKaydee umyalezo we-WhatsApp ukuze uodole. | Aanlyn bestellings open binnekort. Stuur intussen vir Kaydee 'n WhatsApp om te bestel. |
| `order.whatsapp` | WhatsApp Kaydee | WhatsApp uKaydee | WhatsApp Kaydee |
| `footer.tagline` | Freshly made to order! | Zenziwa zintsha xa uodola! | Vars gemaak op bestelling! |
| `footer.contactLabel` | Say hello or ask us anything | Yithi molo okanye usibuze nantoni na | Sê hallo of vra ons enigiets |
| `footer.whatsapp` | WhatsApp | WhatsApp | WhatsApp |
| `footer.rights` | © {year} KD Pops. Handmade with care. | © {year} KD Pops. Zenziwe ngesandla ngononophelo. | © {year} KD Pops. Met liefde handgemaak. |
| `footer.smallBatch` | Small batch · Big joy | Iqela elincinci · Uvuyo olukhulu | Klein hoeveelhede · Groot vreugde |

Menu flavour names and descriptions come from the products table and are English only for now.
