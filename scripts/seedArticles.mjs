import "dotenv/config";

import connectionPool from "../utils/db.mjs";

const articles = [
  {
    title: "How to Plan the Perfect Festival Weekend",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
    category: "Festival",
    description:
      "Build a simple plan for tickets, travel, schedules, food, and rest before your next festival.",
    date: "2025-01-18",
    content: `## Choose the Right Festival

Start with the lineup, location, ticket price, and atmosphere. The best festival is the one that fits your taste and budget.

## Plan the Essentials

Book travel early, save the schedule offline, choose meeting points, and leave room for unexpected performances.`,
  },
  {
    title: "Five Hidden-Gem Festivals Worth Traveling For",
    image:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
    category: "Highlight",
    description:
      "Discover smaller festivals where thoughtful lineups and welcoming crowds create memorable weekends.",
    date: "2025-02-07",
    content: `## Look Beyond the Headliners

Smaller festivals often feature adventurous bookings, shorter lines, and stages where every part of the crowd feels close.

## Make the Trip Part of the Experience

Explore the host city, support local food vendors, and give yourself an extra day to enjoy the destination.`,
  },
  {
    title: "Your First Music Festival: A Practical Survival Guide",
    image:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
    category: "Festival",
    description:
      "Pack smart, stay comfortable, and enjoy your first festival without unnecessary stress.",
    date: "2025-03-14",
    content: `## Pack for Comfort

Bring supportive shoes, sunscreen, a refillable bottle, a portable charger, and layers for changing weather.

## Take Care of Yourself

Drink water, eat proper meals, use hearing protection, and schedule breaks between the performances you cannot miss.`,
  },
  {
    title: "How Music Festivals Are Becoming More Sustainable",
    image:
      "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1200&q=80",
    category: "General",
    description:
      "See how reusable cups, public transport, and cleaner power are reducing festival waste.",
    date: "2025-04-22",
    content: `## Reducing Waste

Reusable cup systems, refill stations, and better recycling signs help keep thousands of disposable items out of landfills.

## Rethinking Transport and Power

Shuttle buses, bike parking, battery storage, and renewable energy can reduce the largest sources of festival emissions.`,
  },
  {
    title: "A Beginner's Guide to Festival Photography",
    image:
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80",
    category: "Inspiration",
    description:
      "Capture stage lights, crowd energy, and personal memories while staying present in the moment.",
    date: "2025-05-09",
    content: `## Work With the Light

Use stage lighting as part of the composition, steady your camera, and wait for moments when the performer enters a bright beam.

## Photograph the Story

Include friends, venue details, signs, food, and wide crowd scenes so the final collection remembers more than the headliner.`,
  },
  {
    title: "How to Recover After a Long Festival Weekend",
    image:
      "https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&w=1200&q=80",
    category: "General",
    description:
      "Use sleep, hydration, gentle movement, and good meals to recover after several days of music.",
    date: "2025-06-02",
    content: `## Restore the Basics

Prioritize water, balanced meals, and a full night of sleep instead of trying to return immediately to a packed schedule.

## Keep the Memories

Organize photos, save the setlists you loved, and write down favorite moments while the weekend still feels fresh.`,
  },
  {
    title: "Why Small Music Venues Matter More Than Ever",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
    category: "Highlight",
    description:
      "Small venues give emerging artists a stage and help local music communities grow.",
    date: "2025-07-19",
    content: `## Where Artists Develop

Independent rooms let performers test new songs, build confidence, and form genuine connections with early supporters.

## How Fans Can Help

Buy tickets directly, arrive for opening acts, purchase merchandise, and recommend great local shows to friends.`,
  },
  {
    title: "Simple Ways to Discover Great Local Artists",
    image:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
    category: "Inspiration",
    description:
      "Find new local music through venue calendars, opening acts, community radio, and recommendations.",
    date: "2025-08-11",
    content: `## Follow the Local Circuit

Check independent venue calendars and follow the artists who regularly appear as support acts for touring musicians.

## Build a Discovery Habit

Save one unfamiliar song each week, listen to community radio, and share the strongest discoveries with friends.`,
  },
  {
    title: "How to Build the Perfect Road-Trip Playlist",
    image:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
    category: "Inspiration",
    description:
      "Create a road-trip soundtrack with energy, variety, shared favorites, and room for discovery.",
    date: "2025-09-05",
    content: `## Shape the Energy

Begin with welcoming songs, raise the tempo for open roads, and save calmer tracks for the final stretch of the drive.

## Make It Collaborative

Ask every passenger to contribute favorites and a few surprises so the playlist becomes part of the shared memory.`,
  },
  {
    title: "Behind the Scenes of a Major Music Festival",
    image:
      "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1200&q=80",
    category: "Highlight",
    description:
      "Explore the planning, production, logistics, and teamwork behind a large festival.",
    date: "2025-10-17",
    content: `## Months of Preparation

Booking, permits, site design, security, transport, and technical production begin long before the gates open.

## A Temporary City

Crews build stages, power networks, medical areas, kitchens, sanitation, and communication systems for one intense weekend.`,
  },
  {
    title: "How Live Music Can Restart Your Creativity",
    image:
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80",
    category: "Inspiration",
    description:
      "Use the energy and emotion of live performance to find fresh ideas for your own creative work.",
    date: "2025-11-08",
    content: `## Pay Attention to Details

Notice transitions, lighting, movement, crowd reactions, and the choices that make a familiar song feel new on stage.

## Turn Energy Into Action

Write down ideas after the show and complete one small creative task before the inspiration has time to fade.`,
  },
  {
    title: "Concert Etiquette That Makes Every Show Better",
    image:
      "https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&w=1200&q=80",
    category: "General",
    description:
      "A few considerate habits can improve the concert experience for artists, staff, and everyone nearby.",
    date: "2025-12-12",
    content: `## Respect Shared Space

Avoid blocking views with a phone for entire songs, keep conversations quiet, and help people move safely through the crowd.

## Support the Whole Show

Arrive for opening artists, follow venue rules, thank staff, and bring the same positive energy you hope to receive.`,
  },
];

const client = await connectionPool.connect();

try {
  await client.query("begin");

  await client.query(`
    create table if not exists public.posts (
      id serial primary key,
      image text not null,
      category_id integer references public.categories(id),
      title varchar not null,
      description text,
      date timestamp default current_date,
      content text not null,
      status_id integer references public.statuses(id),
      likes_count integer default 0
    )
  `);

  for (const categoryName of new Set(
    articles.map((article) => article.category),
  )) {
    await client.query(
      `insert into public.categories (name)
       select $1::varchar
       where not exists (
         select 1
         from public.categories
         where lower(name) = lower($1::varchar)
       )`,
      [categoryName],
    );
  }

  const statusResult = await client.query(
    `select id from public.statuses where lower(status) = 'publish'`,
  );

  if (!statusResult.rowCount) {
    throw new Error("Published status was not found");
  }

  let insertedCount = 0;

  for (const article of articles) {
    const result = await client.query(
      `insert into public.posts
        (title, image, category_id, description, content, status_id, date)
       select
         $1::varchar,
         $2::text,
         categories.id,
         $4::text,
         $5::text,
         $6::integer,
         $7::timestamp
       from public.categories
       where lower(categories.name) = lower($3::varchar)
         and not exists (
           select 1
           from public.posts
           where lower(title) = lower($1::varchar)
         )
       returning id`,
      [
        article.title,
        article.image,
        article.category,
        article.description,
        article.content,
        statusResult.rows[0].id,
        article.date,
      ],
    );

    insertedCount += result.rowCount;
  }

  await client.query("commit");
  console.log(`Inserted ${insertedCount} articles.`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await connectionPool.end();
}
