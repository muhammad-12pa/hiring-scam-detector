"""Content for the "Scam tactics" guide page (/guide): one card per red-flag rule in red_flags.py.

The ids match red_flags.py, so a red flag on a result can link straight to its card (/guide#fee).
"""

GUIDE = [
    {"id": "fee", "severe": True, "title": "Asks you to pay money",
     "example": "Pay a one-time registration fee of ₹1,999 to confirm your seat. Fully refundable after joining.",
     "why": "Genuine employers never charge applicants a registration, training or joining fee. "
            "The “refundable” promise is part of the trick: the money never comes back.",
     "check": ["Never pay to apply, train, get an ID card or book an interview slot.",
               "Ask for the fee in writing from the company’s official email, then call the company’s listed number to confirm. Real HR will say there is no fee.",
               "If you already paid, report it at cybercrime.gov.in or call 1930 straight away."]},
    {"id": "personal_data", "severe": True, "title": "Asks for ID or bank details",
     "example": "Send your Aadhaar, PAN card and bank account details on WhatsApp for direct joining.",
     "why": "Aadhaar, PAN, bank details or an OTP before a verified offer letter is a classic identity-theft move. "
            "These are used to open loans or accounts in your name.",
     "check": ["Share ID only after a written offer, through the company’s official HR portal or in person.",
               "Never share an OTP, CVV or ATM PIN with anyone, for any job.",
               "Mask your Aadhaar (only the last 4 digits) when a copy really is needed."]},
    {"id": "lookalike", "severe": True, "title": "Fake-looking company website",
     "example": "Apply at www.tcs-careers-hiring.in or mail hr@infosys-jobs.online",
     "why": "Scammers borrow a well-known company’s name for their own web and email addresses so the offer looks official. "
            "One extra word or a swapped letter (inf0sys) is enough to fool a quick glance.",
     "check": ["Type the company’s name into a search engine yourself and open its real careers page.",
               "Look at the part just before .com / .in: it should be exactly the company’s own domain.",
               "If the job isn’t listed on the real careers page, treat it as fake."]},
    {"id": "chat_app", "severe": False, "title": "Contact through chat apps",
     "example": "For more details message HR on WhatsApp 98XXXXXX10 or join our Telegram group.",
     "why": "Real recruiters normally use a company email, phone line or official careers portal. "
            "WhatsApp or Telegram alone lets a scammer stay anonymous and disappear.",
     "check": ["Ask for an email from the company’s own domain and a landline you can verify.",
               "Be wary of “interviews” done only by chat, with no video call or office visit.",
               "Never click payment or “task” links sent in a chat group."]},
    {"id": "free_email", "severe": False, "title": "Uses a personal email address",
     "example": "Send your resume to hr.globaljobs2026@gmail.com",
     "why": "Company recruiters use the company’s own domain (name@company.com), not free addresses like Gmail, Yahoo or Outlook, "
            "which anyone can create in a minute.",
     "check": ["Compare the email domain with the company’s real website.",
               "Search the exact email address online: scam addresses are often already reported.",
               "Reply only through the company’s careers page if you’re unsure."]},
    {"id": "easy_money", "severe": False, "title": "Promises easy or unrealistic pay",
     "example": "Earn ₹5,000 per day from home. Guaranteed income, daily payout!",
     "why": "High pay for little work is the hook most scams use. It often leads to “task” scams where you are paid small amounts first, "
            "then asked to deposit money to unlock bigger earnings.",
     "check": ["Compare the pay with the same role on Naukri, LinkedIn or Glassdoor.",
               "“Like videos” or “rate products” for money is a known task scam.",
               "No real job asks you to deposit money to receive your salary."]},
    {"id": "no_interview", "severe": False, "title": "Job without a proper interview",
     "example": "Spot selection! No interview, direct joining from tomorrow.",
     "why": "Offers like “direct joining” or “no interview” skip the checks every real employer does. "
            "Scammers don’t interview because there is no job.",
     "check": ["Expect at least one real interview (video or in person) with named people.",
               "Look the interviewers up on LinkedIn and check they work at that company.",
               "An offer letter should come before any “joining” step, never a payment."]},
    {"id": "urgency", "severe": False, "title": "Pressure to act fast",
     "example": "URGENT HIRING! Only 5 slots left, apply now, last date today.",
     "why": "Urgency is used to stop you from thinking, checking or asking someone. Real hiring processes take days or weeks.",
     "check": ["Slow down: a real offer will still be there tomorrow.",
               "Show the post to a friend, a teacher or your college placement cell.",
               "Paste it into ScamShield before you reply."]},
    {"id": "no_experience", "severe": False, "title": "No skills or experience needed",
     "example": "No experience required. Simple copy-paste typing work. Anyone can apply!",
     "why": "“No experience required” together with high pay is unusual for real jobs. "
            "Fake “data entry” and “typing” jobs often end with a fee or a fake penalty.",
     "check": ["Check what the actual work and skills are. Vague tasks are a warning sign.",
               "Genuine fresher roles still list a selection process and a real company address.",
               "Watch for “penalty for incomplete work” clauses: that’s how typing scams take money."]},
]
