import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedDatabase() {
  console.log('🌱 Seeding FoodFlow Complete 10-Restaurant 50-Dish Food Catalog...');

  // Clean existing data
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  await prisma.user.create({
    data: {
      id: 'usr-demo-001',
      email: 'alex@foodflow.dev',
      name: 'Alex Rivera',
      passwordHash: 'hashed_password_123',
      address: '742 Evergreen Terrace, Sector 4',
      role: 'CUSTOMER'
    }
  });

  await prisma.user.create({
    data: {
      id: 'usr-admin-001',
      email: 'admin@foodflow.dev',
      name: 'Control Operator',
      passwordHash: 'hashed_admin_pass',
      role: 'ADMIN'
    }
  });

  // 1. Japanese Restaurant
  await prisma.restaurant.create({
    data: {
      id: 'rest-001',
      name: 'Tokyo Ramen & Sushi Bar',
      cuisine: 'Japanese',
      address: '12 Shibuya Lane, Downtown',
      rating: 4.9,
      imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80',
      menuItems: {
        create: [
          {
            id: 'menu-101',
            name: 'Tonkotsu Black Garlic Ramen',
            description: 'Rich 16-hour pork bone broth with black garlic oil, chashu pork belly, scallions, and soft nitamago egg.',
            price: 16.50,
            category: 'Ramen',
            imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80'
          },
          {
            id: 'menu-102',
            name: 'Spicy Chili Miso Ramen',
            description: 'Spicy chili miso broth topped with minced pork, bamboo shoots, and wood ear mushrooms.',
            price: 15.99,
            category: 'Ramen',
            imageUrl: 'https://images.unsplash.com/photo-1591814468924-caf88d1232e1?w=600&q=80'
          },
          {
            id: 'menu-103',
            name: 'Salmon Aburi Nigiri Set (6pcs)',
            description: 'Seared Atlantic salmon over seasoned sushi rice drizzled with unagi sauce and spicy mayo.',
            price: 18.50,
            category: 'Sushi',
            imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&q=80'
          },
          {
            id: 'menu-104',
            name: 'Pan-Fried Pork Gyoza (6pcs)',
            description: 'Crispy Japanese pork dumplings served with ponzu soy dipping sauce.',
            price: 7.99,
            category: 'Appetizers',
            imageUrl: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=600&q=80'
          },
          {
            id: 'menu-105',
            name: 'Matcha Green Tea Ice Cream',
            description: 'Authentic Kyoto Uji matcha ice cream topped with sweet red bean paste.',
            price: 5.50,
            category: 'Dessert',
            imageUrl: 'https://images.unsplash.com/photo-1505394033641-40c6ad1178d7?w=600&q=80'
          }
        ]
      }
    }
  });

  // 2. Italian Restaurant
  await prisma.restaurant.create({
    data: {
      id: 'rest-002',
      name: "Mario's Artisanal Pizzeria",
      cuisine: 'Italian',
      address: '45 Via Napoli, Westside',
      rating: 4.8,
      imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80',
      menuItems: {
        create: [
          {
            id: 'menu-201',
            name: 'Neapolitan Margherita Pizza',
            description: 'San Marzano DOP tomato sauce, fresh mozzarella di bufala, fresh basil leaves, extra virgin olive oil.',
            price: 17.99,
            category: 'Pizza',
            imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600&q=80'
          },
          {
            id: 'menu-202',
            name: 'Truffle & Forest Mushroom Pizza',
            description: 'Creamy white base topped with roasted wild mushrooms, truffle oil, and shaved parmesan.',
            price: 22.50,
            category: 'Pizza',
            imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80'
          },
          {
            id: 'menu-203',
            name: 'Double Pepperoni Supreme',
            description: 'Crispy cup pepperoni, mozzarella, spicy salami, hot honey drizzle.',
            price: 19.99,
            category: 'Pizza',
            imageUrl: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&q=80'
          },
          {
            id: 'menu-204',
            name: 'Garlic Butter Dough Balls',
            description: 'Freshly baked wood-fired dough balls tossed in garlic herb butter.',
            price: 6.50,
            category: 'Appetizers',
            imageUrl: 'https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?w=600&q=80'
          },
          {
            id: 'menu-205',
            name: 'Tiramisu Tradizionale',
            description: 'Classic Venetian recipe with espresso drenched ladyfingers and creamy mascarpone.',
            price: 8.99,
            category: 'Dessert',
            imageUrl: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&q=80'
          }
        ]
      }
    }
  });

  // 3. American Smash Burger Joint
  await prisma.restaurant.create({
    data: {
      id: 'rest-003',
      name: 'Smash Burger & Shack',
      cuisine: 'American',
      address: '88 Broadway Street, Midtown',
      rating: 4.7,
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80',
      menuItems: {
        create: [
          {
            id: 'menu-301',
            name: 'Double Bacon Smash Cheeseburger',
            description: 'Two smashed Angus beef patties, double sharp cheddar, crispy smoked bacon, house secret sauce on brioche.',
            price: 14.50,
            category: 'Burgers',
            imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80'
          },
          {
            id: 'menu-302',
            name: 'Crispy Spicy Chicken Sandwich',
            description: 'Buttermilk fried chicken breast, spicy coleslaw, dill pickles, chipotle mayo on toasted potato bun.',
            price: 13.99,
            category: 'Burgers',
            imageUrl: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=600&q=80'
          },
          {
            id: 'menu-303',
            name: 'Truffle Parmesan Waffle Fries',
            description: 'Crispy waffle cut fries tossed in white truffle oil, sea salt, and aged parmesan.',
            price: 6.99,
            category: 'Sides',
            imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=80'
          },
          {
            id: 'menu-304',
            name: 'Buffalo Chicken Wings (8pcs)',
            description: 'Crispy jumbo wings tossed in spicy cayenne buffalo sauce served with blue cheese dip.',
            price: 11.50,
            category: 'Sides',
            imageUrl: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&q=80'
          }
        ]
      }
    }
  });

  // 4. Indian Palace
  await prisma.restaurant.create({
    data: {
      id: 'rest-004',
      name: 'Royal Spice Indian Palace',
      cuisine: 'Indian',
      address: '204 Heritage Way',
      rating: 4.9,
      imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&q=80',
      menuItems: {
        create: [
          {
            id: 'menu-401',
            name: 'Chicken Tikka Masala',
            description: 'Tandoori grilled chicken cooked in a rich, velvety tomato butter cream sauce with aromatic herbs.',
            price: 17.50,
            category: 'Curry',
            imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80'
          },
          {
            id: 'menu-402',
            name: 'Lamb Dum Biryani',
            description: 'Slow-cooked fragrant basmati rice layered with tender marinated lamb, saffron, and fried onions.',
            price: 19.99,
            category: 'Biryani',
            imageUrl: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=600&q=80'
          },
          {
            id: 'menu-403',
            name: 'Paneer Butter Masala',
            description: 'Cottage cheese cubes simmered in a spiced rich tomato cashewnut sauce.',
            price: 15.99,
            category: 'Curry',
            imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&q=80'
          },
          {
            id: 'menu-404',
            name: 'Garlic Butter Naan',
            description: 'Freshly baked tandoori naan brushed with minced garlic and melted ghee.',
            price: 3.99,
            category: 'Breads',
            imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80'
          },
          {
            id: 'menu-405',
            name: 'Sweet Mango Lassi',
            description: 'Refreshing blended yogurt drink with Alphonso mango pulp and cardamom.',
            price: 4.50,
            category: 'Drinks',
            imageUrl: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=600&q=80'
          }
        ]
      }
    }
  });

  // 5. Mexican Taco Bar
  await prisma.restaurant.create({
    data: {
      id: 'rest-005',
      name: 'El Taco & Burrito Bar',
      cuisine: 'Mexican',
      address: '15 Calle Sol, Southside',
      rating: 4.7,
      imageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80',
      menuItems: {
        create: [
          {
            id: 'menu-501',
            name: 'Carne Asada Street Tacos (3pcs)',
            description: 'Grilled marinated flank steak on warm corn tortillas topped with cilantro, diced onions, and salsa verde.',
            price: 12.99,
            category: 'Tacos',
            imageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80'
          },
          {
            id: 'menu-502',
            name: 'Loaded Guacamole Mission Burrito',
            description: 'Large flour tortilla stuffed with grilled chicken, black beans, cilantro lime rice, fresh guacamole, and pico de gallo.',
            price: 13.50,
            category: 'Burritos',
            imageUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&q=80'
          },
          {
            id: 'menu-503',
            name: 'Crispy Cinnamon Churros',
            description: 'Warm fried pastry dough coated in cinnamon sugar served with warm dulce de leche dip.',
            price: 5.99,
            category: 'Dessert',
            imageUrl: 'https://images.unsplash.com/photo-1624371414361-e670edf4898d?w=600&q=80'
          }
        ]
      }
    }
  });

  // 6. Chinese House
  await prisma.restaurant.create({
    data: {
      id: 'rest-006',
      name: 'Golden Dragon Chinese House',
      cuisine: 'Chinese',
      address: '88 Chinatown Avenue',
      rating: 4.8,
      imageUrl: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&q=80',
      menuItems: {
        create: [
          {
            id: 'menu-601',
            name: 'Kung Pao Spicy Chicken',
            description: 'Wok-tossed tender chicken with roasted peanuts, red chili peppers, and scallions in savory sauce.',
            price: 15.99,
            category: 'Mains',
            imageUrl: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&q=80'
          },
          {
            id: 'menu-602',
            name: 'Yang Chow Special Fried Rice',
            description: 'Fragrant jasmine rice fried with BBQ pork, shrimp, egg, and green peas.',
            price: 13.50,
            category: 'Rice & Noodles',
            imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&q=80'
          },
          {
            id: 'menu-603',
            name: 'Steamed Pork Dim Sum (4pcs)',
            description: 'Handcrafted pork and shrimp dim sum dumplings served with chili soy dip.',
            price: 8.50,
            category: 'Appetizers',
            imageUrl: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=600&q=80'
          }
        ]
      }
    }
  });

  // 7. Thai Street Food
  await prisma.restaurant.create({
    data: {
      id: 'rest-007',
      name: 'Bangkok Street Thai Kra Pao',
      cuisine: 'Thai',
      address: '77 Sukhumvit Boulevard',
      rating: 4.9,
      imageUrl: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&q=80',
      menuItems: {
        create: [
          {
            id: 'menu-701',
            name: 'Pad Thai Shrimp Noodles',
            description: 'Stir-fried rice noodles with tiger prawns, tofu, bean sprouts, crushed peanuts, and tamarind sauce.',
            price: 16.50,
            category: 'Noodles',
            imageUrl: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&q=80'
          },
          {
            id: 'menu-702',
            name: 'Thai Green Curry Chicken',
            description: 'Spicy green curry paste, coconut milk, Thai eggplant, bamboo shoots, and fresh basil.',
            price: 15.99,
            category: 'Curry',
            imageUrl: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=600&q=80'
          },
          {
            id: 'menu-703',
            name: 'Mango Sticky Rice',
            description: 'Fresh ripe mango slices served over warm coconut sticky rice sprinkled with sesame seeds.',
            price: 7.50,
            category: 'Dessert',
            imageUrl: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=600&q=80'
          }
        ]
      }
    }
  });

  // 8. French Bistro
  await prisma.restaurant.create({
    data: {
      id: 'rest-008',
      name: 'Le Petit French Bistro',
      cuisine: 'French',
      address: '14 Rue de Paris',
      rating: 4.8,
      imageUrl: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=600&q=80',
      menuItems: {
        create: [
          {
            id: 'menu-801',
            name: 'Classic French Onion Soup',
            description: 'Caramelized onion broth topped with a toasted baguette slice and melted Gruyère cheese.',
            price: 11.50,
            category: 'Soups',
            imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80'
          },
          {
            id: 'menu-802',
            name: 'Beef Bourguignon',
            description: 'Slow-braised beef chuck in red wine broth with pearl onions, bacon lardons, and carrots.',
            price: 24.99,
            category: 'Mains',
            imageUrl: 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=600&q=80'
          },
          {
            id: 'menu-803',
            name: 'Vanilla Bean Crème Brûlée',
            description: 'Rich custard base topped with a layer of hardened caramelized sugar.',
            price: 8.50,
            category: 'Dessert',
            imageUrl: 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=600&q=80'
          }
        ]
      }
    }
  });

  // 9. Healthy & Vegan
  await prisma.restaurant.create({
    data: {
      id: 'rest-009',
      name: 'Verde Green Bowl & Juicery',
      cuisine: 'Healthy & Vegan',
      address: '104 Eco Avenue',
      rating: 4.9,
      imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80',
      menuItems: {
        create: [
          {
            id: 'menu-901',
            name: 'Avocado Quinoa Power Bowl',
            description: 'Organic fluffy quinoa, fresh Hass avocado, roasted chickpeas, massaged kale, cherry tomatoes, and creamy tahini dressing.',
            price: 14.99,
            category: 'Bowls',
            imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80'
          },
          {
            id: 'menu-902',
            name: 'Organic Acai Energy Bowl',
            description: 'Blended organic acai berry smoothie topped with hemp granola, fresh strawberries, blueberries, chia seeds, and honey.',
            price: 12.50,
            category: 'Bowls',
            imageUrl: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=600&q=80'
          }
        ]
      }
    }
  });

  // 10. Desserts & Bakery
  await prisma.restaurant.create({
    data: {
      id: 'rest-010',
      name: 'Sweet Tooth Desserts & Bakery',
      cuisine: 'Desserts & Coffee',
      address: '12 Sweet Lane',
      rating: 4.9,
      imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&q=80',
      menuItems: {
        create: [
          {
            id: 'menu-1001',
            name: 'Belgian Chocolate Fudge Waffle',
            description: 'Warm crispy Belgian waffle drizzled with melted dark Belgian chocolate and vanilla bean gelato.',
            price: 9.99,
            category: 'Waffles',
            imageUrl: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=600&q=80'
          },
          {
            id: 'menu-1002',
            name: 'New York Baked Cheesecake',
            description: 'Rich dense cheesecake with a graham cracker crust and wild berry compote.',
            price: 7.99,
            category: 'Cakes',
            imageUrl: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&q=80'
          },
          {
            id: 'menu-1003',
            name: 'Iced Caramel Macchiato',
            description: 'Fresh espresso layered with steamed milk, vanilla syrup, and rich caramel drizzle.',
            price: 5.25,
            category: 'Coffee',
            imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&q=80'
          }
        ]
      }
    }
  });

  console.log(`✅ Seeded ${await prisma.user.count()} users, ${await prisma.restaurant.count()} restaurants, ${await prisma.menuItem.count()} menu items.`);
}

if (require.main === module) {
  seedDatabase()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
