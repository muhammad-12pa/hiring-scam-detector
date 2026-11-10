"""Synthetic Indian job postings (scam and genuine) to fill a gap in EMSCAD.

EMSCAD (fake_job_postings.csv) has 866 fake postings but only 14 from India, and none
of the scam patterns common in India today: registration / training / security-deposit
fees, Aadhaar / PAN / bank / OTP requests, WhatsApp- or Telegram-only contact, "task"
and like-and-earn jobs, fake offer letters, overseas visa-fee scams. In EMSCAD,
"registration" and "WhatsApp" appear almost only in genuine posts, so the model learned
them as safe signals.

Every example here is SYNTHETIC (template-generated) and must be reported as such.
Genuine Indian postings are generated too, in equal number, so the model doesn't simply
learn "Indian city or rupees = scam". Some genuine posts deliberately mention
WhatsApp updates, online registration or "no fee is charged", so single words can't
decide the label on their own.

Train/test separation: every phrase list is split in two with a fixed seed. Training
examples use only the first half and test examples only the second half, so test
sentences are never seen during training.
"""
import random

CITIES = ["Kochi", "Bengaluru", "Chennai", "Hyderabad", "Pune", "Mumbai", "Delhi", "Noida", "Gurugram",
          "Kolkata", "Ahmedabad", "Jaipur", "Coimbatore", "Mangaluru", "Thiruvananthapuram", "Kozhikode",
          "Lucknow", "Indore", "Bhubaneswar", "Nagpur", "Visakhapatnam", "Chandigarh", "Mysuru", "Surat"]
COMPANY_WORDS = ["Tech", "Infotech", "Solutions", "Systems", "Global", "Digital", "Services", "Consultancy",
                 "Software", "Networks", "Enterprises", "Retail", "Logistics", "Analytics", "Labs", "Ventures"]
COMPANY_PREFIX = ["Arya", "Nexa", "Sahyadri", "Vistara", "Kaveri", "Lotus", "Prism", "Zenith", "Orbit", "Sapphire",
                  "Indus", "Trident", "Saffron", "Everest", "Pinnacle", "Aurora", "Matrix", "Quantum", "Nila", "Ganga",
                  "Bharat", "Kairali", "Suvarna", "Amrit", "Neel", "Vayu", "Agni", "Pragati", "Unnati", "Shakti"]

# ---------------- scam building blocks ----------------
SCAM_TITLES = [
    "Data Entry Operator (Work From Home)", "Part Time Job - Earn Daily", "Online Typing Work", "Form Filling Job",
    "Home Based Copy Paste Work", "Amazon Product Review Job", "YouTube Video Like Task", "Telegram Task Job",
    "Hotel Rating Task Work", "Back Office Executive (Urgent)", "Airport Ground Staff Recruitment",
    "Railway Office Assistant", "SMS Sending Job", "Captcha Typing Work", "Mobile Based Part Time Job",
    "Customer Care Executive - Direct Joining", "Gulf Job - Driver / Helper", "Dubai Hotel Staff Vacancy",
    "Freshers Hiring - Offer Letter Ready", "Work From Home - Students and Housewives",
    "Online Survey Job", "Google Map Review Job", "Instagram Follow Task", "Ad Posting Work",
]
SCAM_HOOKS = [
    "Earn Rs {daily} per day from your mobile.", "Earn {daily} rupees daily, payment every evening.",
    "Daily payout of Rs {daily} guaranteed.", "Make Rs {monthly} per month working only 2 hours a day.",
    "Weekly income of Rs {weekly} without any target.", "Simple work, earn upto Rs {daily} per day.",
    "Get paid Rs {per_task} for every task completed.", "Salary Rs {monthly} plus daily incentives.",
    "Income up to {monthly} per month from home.", "Earn Rs {per_task} per like, unlimited tasks.",
    "Guaranteed income of Rs {weekly} every week.", "Fixed salary {monthly} per month, no target, no pressure.",
]
SCAM_EASY = [
    "No experience required.", "No qualification needed, anyone can apply.", "Freshers, students and housewives can join.",
    "Only basic mobile knowledge needed.", "No interview, no skills needed.", "10th pass or 12th pass can apply.",
    "Any graduate or non graduate can do this work.", "Simple copy paste work, no target.",
    "Just like videos and send screenshots.", "Work only 1 to 2 hours daily from home.",
    "No selling, no calling, only online work.", "Age 18 to 45, male or female, anyone can do.",
]
SCAM_FEES = [
    "Pay a one time registration fee of Rs {fee} to activate your ID.", "Registration charges Rs {fee} only (refundable).",
    "A refundable security deposit of Rs {fee} is required before joining.", "Training fee of Rs {fee} to be paid in advance.",
    "Pay Rs {fee} for the ID card and joining kit.", "Laptop and software charges Rs {fee}, paid before offer letter.",
    "Visa processing fee Rs {fee} to be paid within 2 days.", "Interview slot booking charge Rs {fee}.",
    "To start tasks, recharge your account with Rs {fee}.", "Pay Rs {fee} as account activation amount on Paytm or GPay.",
    "Medical and documentation charges Rs {fee} payable in advance.", "Deposit Rs {fee} to unlock high paying tasks.",
    "Offer letter will be sent after you pay the processing fee of Rs {fee}.", "Pay Rs {fee} as joining amount, fully refundable after 1 month.",
]
SCAM_DATA = [
    "Send your Aadhaar card, PAN card and bank account details for verification.", "Share Aadhaar number and bank passbook photo.",
    "Send your bank account number, IFSC code and the OTP you receive to complete registration.",
    "Share PAN card and ATM card photo for salary account.", "Send Aadhaar and PAN copy on WhatsApp for document verification.",
    "Provide your UPI ID and UPI PIN to receive your first payment.", "Send passport copy and bank details for visa processing.",
    "Share your net banking details for direct salary credit.", "Send the 6 digit OTP for account activation.",
    "Send Aadhaar, PAN and a cancelled cheque to confirm your job.",
]
SCAM_CONTACT = [
    "Contact HR on WhatsApp {phone}.", "WhatsApp your name and city to {phone}.", "Message us on Telegram @{handle} to start.",
    "Join our Telegram group for daily tasks: t.me/{handle}.", "Call or WhatsApp {phone}, no calls after 8 pm.",
    "Send Hi on WhatsApp {phone} for details.", "Contact our manager on Telegram @{handle}.",
    "Email your details to {mail} or WhatsApp {phone}.", "For joining, contact {mail}.",
    "Click the link and fill the form: bit.ly/{handle}.", "DM us on Instagram @{handle} for the job link.",
    "Register at tinyurl.com/{handle} and wait for the call.",
]
SCAM_URGENCY = [
    "Limited seats, apply immediately.", "Only 20 slots left, hurry up!", "Urgent requirement, direct joining today.",
    "Offer valid only today.", "Immediate joining, selection on the spot.", "Last date today, apply now.",
    "First come first serve.", "Vacancies filling fast, confirm your seat now.", "Join within 24 hours or the offer will be cancelled.",
    "Hurry, last few positions remaining.",
]
SCAM_PROFILES = [
    "", "", "We are a leading MNC company with offices all over India.", "Reputed international company hiring across India.",
    "Government approved recruitment agency.", "Trusted online work provider since 2015.", "Top multinational company, 100% genuine work.",
    "Leading e-commerce partner company.", "Authorised placement partner for airlines and railways.",
]
SCAM_BENEFITS = ["", "", "Daily payment to bank or UPI.", "Weekly payment, bonus on referrals.", "Free training, certificate provided.",
                 "Work from home, flexible timing.", "Salary plus food and accommodation (for Gulf jobs).", "Payment proof will be shared."]

# ---------------- genuine building blocks ----------------
GEN_TITLES = [
    "Software Developer (Freshers)", "Java Developer", "Python Developer", "Frontend Developer (React)", "QA Engineer",
    "Data Analyst", "Junior Accountant", "Accounts Executive", "HR Executive", "Customer Support Executive",
    "Sales Executive", "Business Development Associate", "Digital Marketing Executive", "Graphic Designer",
    "Staff Nurse", "Pharmacist", "Mathematics Teacher", "Office Administrator", "Mechanical Design Engineer",
    "Civil Site Engineer", "Electrical Maintenance Technician", "Content Writer", "Network Administrator",
    "Technical Support Engineer", "Logistics Coordinator", "Store Manager", "Bank Relationship Officer",
    "Production Supervisor", "Lab Technician", "Front Office Executive",
]
GEN_PROFILE = [
    "{co} is a {years}-year-old {kind} company based in {city}, serving clients across India.",
    "Founded in {founded}, {co} builds {product} for small and medium businesses.",
    "{co} is an ISO 9001 certified {kind} firm with {staff} employees in {city} and {city2}.",
    "We are a growing {kind} company headquartered in {city}.",
    "{co} operates {count} branches across South India.",
    "",
]
GEN_DUTIES = {
    "tech": ["You will write and maintain code for our web applications.", "You will work with the product team to build new features.",
             "Write unit tests and take part in code reviews.", "Fix bugs reported by customers and the QA team.",
             "Build REST APIs and integrate them with the frontend.", "Document your work and support releases."],
    "office": ["Prepare monthly reports for the management.", "Maintain records in Tally and Excel.",
               "Coordinate with vendors and internal teams.", "Handle GST filing and bank reconciliation.",
               "Manage employee onboarding and attendance records.", "Answer customer queries by phone and email."],
    "field": ["Visit client sites in and around {city}.", "Meet monthly sales targets agreed with your manager.",
              "Maintain equipment and keep service logs.", "Supervise contractors and ensure safety standards.",
              "Coordinate deliveries with the warehouse team.", "Prepare quotations and follow up with customers."],
}
GEN_REQ = {
    "tech": ["B.Tech / B.E. in Computer Science or a related field.", "Knowledge of Java or Python and SQL.",
             "Freshers from the 2025 or 2026 batch are welcome.", "{exp} to {exp2} years of experience with React or Angular.",
             "Understanding of Git, REST APIs and basic cloud concepts.", "MCA or B.Sc Computer Science with good problem-solving skills."],
    "office": ["B.Com or M.Com with {exp} years of experience in accounts.", "Any graduate with good communication skills.",
               "Good working knowledge of MS Excel and Tally.", "Fluency in English and {lang}.",
               "MBA in HR or a related field preferred.", "{exp} to {exp2} years of relevant experience."],
    "field": ["Diploma or B.Tech in Mechanical or Electrical Engineering.", "Two-wheeler with a valid driving licence preferred.",
              "{exp} to {exp2} years of experience in sales or service.", "Fluency in English and {lang}.",
              "Willingness to travel within the state.", "B.Sc Nursing or GNM with a valid State Nursing Council registration."],
}
GEN_PROCESS = [
    "Selection process: online aptitude test, technical interview and HR interview.",
    "Shortlisted candidates will be called for an interview at our {city} office.",
    "The selection includes a written test and a face-to-face interview.",
    "There will be two rounds of interviews, one technical and one with the hiring manager.",
    "Candidates will be shortlisted based on their resume, followed by a video interview.",
    "Selected candidates will receive an offer letter by email after background verification.",
]
GEN_APPLY = [
    "Apply through the Careers page on our website.", "Apply on Naukri.com or through our careers portal.",
    "Send your resume to careers@{domain}.", "Apply via LinkedIn or email hr@{domain}.",
    "Register on our careers portal and upload your resume.", "Email your CV to jobs@{domain} with the job title in the subject.",
    "Apply through our official website. Interview updates will also be sent on WhatsApp.",
    "Walk-in interview at our {city} office between 10 am and 1 pm, Monday to Friday.",
]
GEN_NOFEE = ["", "", "", "We do not charge any fee at any stage of recruitment.", "No fee is charged for the interview or joining.",
             "Beware of fake job offers. We never ask for money or bank details."]
GEN_BENEFITS = [
    "CTC {lpa1} to {lpa2} LPA, health insurance and paid leave.", "Salary {sal1} to {sal2} per month based on experience, PF and ESI.",
    "Competitive salary, medical insurance and annual bonus.", "Salary as per industry standards, 5 day work week.",
    "Fixed salary plus performance incentives, PF and gratuity.", "Paid leave, festival holidays and training support.",
]
LANGS = ["Malayalam", "Kannada", "Tamil", "Telugu", "Hindi", "Marathi", "Bengali"]
KINDS = ["software", "accounting", "manufacturing", "healthcare", "education", "retail", "logistics", "construction", "IT services"]
PRODUCTS = ["billing software", "inventory tools", "mobile apps", "HR software", "e-learning platforms"]


def _split(lst, rng):
    """Split a phrase list into (train, test) halves with a fixed shuffle."""
    items = list(lst)
    rng.shuffle(items)
    k = max(1, len(items) // 2)
    return items[k:], items[:k]  # train gets the larger half when odd


def _pools(seed=7):
    rng = random.Random(seed)
    names = ["SCAM_TITLES", "SCAM_HOOKS", "SCAM_EASY", "SCAM_FEES", "SCAM_DATA", "SCAM_CONTACT", "SCAM_URGENCY",
             "GEN_TITLES", "GEN_PROCESS", "GEN_APPLY", "GEN_BENEFITS", "GEN_PROFILE"]
    pools = {"train": {}, "test": {}}
    for n in names:
        tr, te = _split(globals()[n], rng)
        pools["train"][n], pools["test"][n] = tr, te
    for kind, duties in GEN_DUTIES.items():
        tr, te = _split(duties, rng)
        pools["train"]["duty_" + kind], pools["test"]["duty_" + kind] = tr, te
    for kind, reqs in GEN_REQ.items():
        tr, te = _split(reqs, rng)
        pools["train"]["req_" + kind], pools["test"]["req_" + kind] = tr, te
    return pools


def _company(rng):
    return f"{rng.choice(COMPANY_PREFIX)} {rng.choice(COMPANY_WORDS)} Pvt. Ltd."


def _phone(rng):
    return f"{rng.choice('6789')}{rng.randint(100000000, 999999999)}"


def _handle(rng):
    return rng.choice(["hr", "jobs", "work", "earn", "task", "career", "hiring", "india"]) + rng.choice(["_desk", "4u", "247", "_official", "zone", "hub"]) + str(rng.randint(1, 99))


def _fmt(s, rng, **extra):
    city, city2 = rng.sample(CITIES, 2)
    vals = dict(daily=rng.choice([500, 800, 1000, 1500, 2000, 3000, 5000]), weekly=rng.choice([5000, 8000, 10000, 15000, 25000]),
                monthly=rng.choice(["25,000", "30,000", "40,000", "50,000", "75,000"]), per_task=rng.choice([50, 100, 150, 200, 300]),
                fee=rng.choice([499, 999, 1499, 2000, 2500, 3500, 5000, 8500]), phone=_phone(rng), handle=_handle(rng),
                mail=rng.choice(["hr.jobs", "careers.india", "recruit.team", "joboffer", "hrdesk"]) + str(rng.randint(1, 999)) + "@" + rng.choice(["gmail.com", "yahoo.com", "outlook.com", "rediffmail.com"]),
                city=city, city2=city2, exp=rng.randint(1, 3), exp2=rng.randint(4, 6), lang=rng.choice(LANGS),
                lpa1=rng.choice(["3", "3.5", "4", "5"]), lpa2=rng.choice(["6", "7", "8"]), sal1=rng.choice(["18,000", "20,000", "25,000"]),
                sal2=rng.choice(["30,000", "35,000", "40,000"]), years=rng.randint(5, 30), founded=rng.randint(1995, 2018),
                staff=rng.choice([60, 120, 250, 500, 1200]), count=rng.randint(3, 25), kind=rng.choice(KINDS), product=rng.choice(PRODUCTS))
    vals.update(extra)
    return s.format(**vals)


def make_scam(rng, P):
    title = rng.choice(P["SCAM_TITLES"])
    parts = [rng.choice(P["SCAM_HOOKS"]), rng.choice(P["SCAM_EASY"])]
    # every scam uses 2-4 of the warning patterns, never all of them
    tricks = rng.sample(["fee", "data", "contact", "urgency"], rng.randint(2, 4))
    if "fee" in tricks:
        parts.append(rng.choice(P["SCAM_FEES"]))
    if "data" in tricks:
        parts.append(rng.choice(P["SCAM_DATA"]))
    if "urgency" in tricks:
        parts.append(rng.choice(P["SCAM_URGENCY"]))
    parts.append(rng.choice(P["SCAM_CONTACT"]))  # scams almost always give an off-platform contact
    rng.shuffle(parts)
    profile = rng.choice(SCAM_PROFILES)
    location = rng.choice(["", f" - {rng.choice(CITIES)}", " - All India", " - Work From Home"])
    text = " ".join([title + location, profile, " ".join(parts), rng.choice(SCAM_BENEFITS)])
    return _fmt(" ".join(text.split()), rng)


def make_genuine(rng, P):
    co = _company(rng)
    domain = co.split()[0].lower() + co.split()[1].lower() + rng.choice([".com", ".in", ".co.in"])
    title = rng.choice(P["GEN_TITLES"])
    kind = "tech" if any(w in title for w in ["Developer", "Engineer", "QA", "Data", "Network", "Technical"]) else rng.choice(["office", "field"])
    duties = rng.sample(P["duty_" + kind], min(2, len(P["duty_" + kind])))
    reqs = rng.sample(P["req_" + kind], min(2, len(P["req_" + kind])))
    parts = [f"{title} - {co}, {{city}}", rng.choice(P["GEN_PROFILE"]), "Responsibilities: " + " ".join(duties),
             "Requirements: " + " ".join(reqs), rng.choice(P["GEN_PROCESS"]), rng.choice(P["GEN_BENEFITS"]),
             rng.choice(P["GEN_APPLY"]), rng.choice(GEN_NOFEE)]
    return _fmt(" ".join(" ".join(parts).split()), rng, co=co, domain=domain)


def generate(n_each, split="train", seed=42):
    """Return (texts, labels): n_each scams (label 1) and n_each genuine posts (label 0)."""
    P = _pools()[split]
    rng = random.Random(seed + (0 if split == "train" else 1000))
    texts, labels = [], []
    for _ in range(n_each):
        texts.append(make_scam(rng, P)); labels.append(1)
        texts.append(make_genuine(rng, P)); labels.append(0)
    return texts, labels


if __name__ == "__main__":
    for split in ["train", "test"]:
        t, l = generate(2, split)
        print(f"--- {split} ---")
        for x, y in zip(t, l):
            print(("SCAM " if y else "REAL ") + x, "\n")
