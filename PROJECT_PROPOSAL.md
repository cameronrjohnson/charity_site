# Charity Finder Project Proposal

**Cameron Johnson**  
**CSE 499**  
**Instructor:** Scott Currell

## Project Name

Charity Finder

## Visual Theme

The site uses a calm, welcoming palette from [Coolors](https://coolors.co/67597a-544e61-6e8894-85baa1-ceeddb):

| Color | Hex | Use |
| --- | --- | --- |
| Deep charcoal purple | `#544e61` | Primary buttons and main text |
| Muted purple | `#67597a` | Secondary text and focus indicators |
| Blue gray | `#6e8894` | Borders and structural details |
| Soft green | `#85baa1` | Progress and small accents |
| Pale mint | `#ceeddb` | Highlighted and placeholder backgrounds |

White surfaces keep the page readable and let the colors provide gentle emphasis.

## Team with Contact Information

N/A

## Stakeholders with Contact Information

N/A

## Project Purpose

My project will help solve the problem of donors not being able to find a trustworthy charity to donate to without being bombarded with irrelevant information.

## Background/Prior Knowledge

I am a beginner when it comes to building websites. The only websites that I have built in the past are static sites that use very little amount of dynamic elements, such as small databases and forms. I have no knowledge when it comes to different charities.

## Description

My website will be a dynamic website that includes user authentication to save user data such as favorite charities or comments left by other users about different charities. It will include a quiz that the user can take to better assist the user in finding a charity that fits his/hers ideals. It will also include an AI agent at the very end of the quiz if the user still has a hard time deciding.

I have yet to find anywhere online that offers any kind of quiz or guidance when finding somewhere to donate to. The only sites that I have found that have lots of information about different orgs only include a search bar with thousands of places that have questionable reputations.

## Significance

I hope to help build a place where users can go to find a place to make a meaningful impact without bloat or misinformation. I will put it on my resume.

> Created a charity-finding website used by x amount of users that has helped raise x amount of money using the React framework.

## New Computer Science Concepts

I will need to learn how to implement some kind of API into my site that can pull in data from other sources to find different charities to donate to. I will also need to find a way to use an AI chatbot to help guide the user. I also need to learn how to save user information and store it safely.

## Interestingness

This is interesting to me because I would use it myself. I see a real need for this and want to build something that I can see other people using. It is also something easy to measure and would look great on a resume.

## Milestones, Tasks, and Schedule

I plan on spending around 12 hours a week on each task.

1. Create blueprint for site
2. Polish site blueprint
3. Add in user authentication and publish site
4. Add in user data (favorites/comments)
5. Add in user form
6. Add in AI chatbot
7. API Learning
8. Find a charity API / Implement API learning
9. Implement API learning
10. Implement API learning continued
11. Extra time
12. Polish site

## Resources

I will use my home computer to build the site. I plan on publishing the site through GitHub Pages and using Supabase as my free database to store user information and authentication. I will do my learning through YouTube and ChatGPT.

The static site uses Supabase Auth for email-and-password sign-in. Its client-side publishable key is configured in `js/supabase-client.js`; never put a Supabase `service_role` key in browser code. For immediate sign-in after account creation, disable email confirmation in Supabase Auth settings and set the deployed site URL in the project's URL configuration.

### User data setup

Run [the user community migration](supabase/migrations/20261024000100_user_community.sql) once in the Supabase SQL editor before using comments or favorites. Alternatively, apply it through the Supabase CLI migration workflow after linking this project. Serve the site over HTTP locally (for example, `python -m http.server 8765`) or deploy it to GitHub Pages; do not open it with `file://`.

The migration creates `comments`, `comment_likes`, and `favorites` with Row Level Security. Signed-in users can post and delete their own comments, like/unlike comments, and save/remove charities. Each user can like a comment or save a charity only once. Deleting a comment removes its likes; deleting an Auth user removes their comments, likes, and favorites. Comments are limited to 2,000 characters and are publicly readable through `get_charity_comments`, which returns 20 at a time without exposing user IDs or email addresses. Comment author labels are "You" or "Community member" until public profiles exist. Direct table reads and deletes are restricted to the current user's rows, and updates are not permitted.

Saved charities are private and accessible in the directory's **Your saved charities** section. The temporary `charity_id` enum and `js/charities.js` share the IDs `direct-relief`, `donorschoose`, and `nature-conservancy`. Add new enum values and registry entries together until a real charities table replaces them. Database errors appear in the page rather than falling back to sample data.

Run the JavaScript data-access tests with `node --experimental-vm-modules --test tests/community-data.test.mjs`. The rollback-only database tests in `supabase/tests/database/user_community.test.sql` exercise ownership, public discussion reads, constraints, and cascading deletes using two temporary users. Run them with `supabase test db --linked` after linking the intended project; the CLI test runner requires Docker Desktop. The test transaction rolls back its fixtures and any test extension installation.

## Dependencies

My IDE of choice is VS Code. My home computer runs on Windows, and I will be programming the site in JavaScript with the React framework. I plan on using OpenAI’s free tier to help with the chatbot.

## Risks

The biggest risk that I can think of is GitHub Pages only supporting static webpages. There might be a way around this if I encapsulate my dynamic elements in static timers (this could be the chatbot being set on a timer to update every five seconds instead of when the user types). I am also worried about getting all of the information about the different charities. I might need to have to hardcode the first 100 or so options and then include a form later on for other users to add more options depending on what is out there.
