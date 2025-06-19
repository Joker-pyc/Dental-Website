const chatbotBubble = document.getElementById('chatbot-bubble');
const chatbotWindow = document.getElementById('chatbot-window');
const chatbotClose = document.getElementById('chatbot-close');
const chatbotForm = document.getElementById('chatbot-form');
const chatbotInput = document.getElementById('chatbot-input');
const chatbotMessages = document.getElementById('chatbot-messages');

let bookingState = null;
let bookingData = {};
let userContext = {
  name: null,
  previousQuestions: [],
  currentTopic: null,
  conversationCount: 0,
  sessionId: Date.now()
};

const clinicInfo = {
  name: "Rain Dental Aesthetic and Implant Centre",
  services: [
    "Periodontal Surgical Procedures",
    "Dental Implants",
    "Digital X-ray",
    "Smile Designing",
    "Cosmetic Dentistry",
    "Teeth Replacement",
    "Teeth Cleaning and Polishing",
    "Teeth Whitening",
    "Orthodontics (Braces & Aligners)",
    "Tooth Extraction",
    "Restorative Dentistry",
    "Root Canal Treatment",
    "Emergency Dental Care",
    "Pediatric Dentistry",
    "Oral Surgery"
  ],
  hours: {
    weekdays: "Monday-Saturday: 10:00 AM – 1:00 PM & 5:00 PM – 9:00 PM",
    sunday: "Sunday: By Appointment Only"
  },
  contact: {
    phones: ["+91 90040 15693", "+91 86690 48892"],
    whatsapp: "8669048892",
    location: "Mumbai"
  },
  doctor: {
    name: "Dr. Anjali Jha",
    qualifications: "B.D.S | M.D.S",
    specialization: "Consultant Periodontist & Oral Implantologist"
  },
  mapEmbed: `<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3769.595801421595!2d72.86784709999999!3d19.125380099999997!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7c93eecbf2ead%3A0x6342cfe439156f9e!2sRain%20Dental%20Aesthetic%20and%20Implant%20Centre%20%7C%20Dr.%20Anjali%20Jha!5e0!3m2!1sen!2sin!4v1750236059599!5m2!1sen!2sin" width="100%" height="250" style="border:0; border-radius: 8px;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
};

const patterns = {
  greeting: /\b(hi|hello|hey|good\s+(morning|afternoon|evening)|greetings|namaste)\b/i,
  booking: /\b(book|schedule|appointment|visit|reserve|appoint)\b/i,
  services: /\b(service|treatment|procedure|what\s+do\s+you\s+(do|offer)|dental\s+work|treatments)\b/i,
  hours: /\b(hours|timing|time|open|close|when\s+are\s+you|schedule)\b/i,
  location: /\b(location|address|where|direction|how\s+to\s+reach|map|navigate)\b/i,
  contact: /\b(contact|phone|call|number|reach\s+you|whatsapp)\b/i,
  doctor: /\b(doctor|dentist|specialist|who\s+is|dr\.?|physician)\b/i,
  cost: /\b(cost|price|fee|charge|expensive|affordable|how\s+much|rates)\b/i,
  pain: /\b(pain|hurt|ache|sore|emergency|urgent|swelling|bleeding)\b/i,
  thanks: /\b(thank|thanks|appreciate|grateful)\b/i,
  goodbye: /\b(bye|goodbye|see\s+you|take\s+care|exit|quit)\b/i,
  yes: /^(yes|yeah|yep|sure|ok|okay|y|definitely|absolutely|correct|right)$/i,
  no: /^(no|nope|nah|n|cancel|stop|wrong|incorrect)$/i,
  help: /\b(help|assist|support|guide|what\s+can\s+you\s+do)\b/i
};

const quickReplies = {
  services: ['Root Canal', 'Dental Implant', 'Teeth Cleaning', 'Smile Design', 'Braces'],
  timeSlots: ['10:00 AM', '11:00 AM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM'],
  concerns: ['Tooth Pain', 'Cleaning', 'Cosmetic', 'Check-up', 'Emergency']
};

function showChatbot() {
  chatbotWindow.classList.add('active');
  setTimeout(() => chatbotInput.focus(), 100);
}

function hideChatbot() {
  chatbotWindow.classList.remove('active');
}

function toggleChatbot() {
  chatbotWindow.classList.contains('active') ? hideChatbot() : showChatbot();
}

chatbotBubble.addEventListener('click', showChatbot);
chatbotBubble.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    showChatbot();
  }
});
chatbotClose.addEventListener('click', hideChatbot);

function addMessage(text, sender = 'bot', typing = false) {
  const msg = document.createElement('div');
  msg.className = sender === 'user' ? 'user-message' : 'bot-message';
  
  if (typing && sender === 'bot') {
    msg.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    chatbotMessages.appendChild(msg);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    
    setTimeout(() => {
      msg.innerHTML = text;
      addQuickReplies(msg);
    }, Math.random() * 800 + 600);
  } else {
    msg.innerHTML = text;
    chatbotMessages.appendChild(msg);
    addQuickReplies(msg);
  }
  
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  return msg;
}

function addQuickReplies(messageElement) {
  const message = messageElement.innerHTML.toLowerCase();
  let replies = [];
  
  if (message.includes('service') || message.includes('treatment')) {
    replies = quickReplies.services;
  } else if (message.includes('time') && bookingState === 'time') {
    replies = quickReplies.timeSlots;
  } else if (message.includes('concern') && bookingState === 'concern') {
    replies = quickReplies.concerns;
  }
  
  if (replies.length > 0) {
    const quickReplyContainer = document.createElement('div');
    quickReplyContainer.className = 'quick-replies';
    quickReplyContainer.innerHTML = replies.map(reply => 
      `<button class="quick-reply-btn" onclick="handleQuickReply('${reply}')">${reply}</button>`
    ).join('');
    messageElement.appendChild(quickReplyContainer);
  }
}

function handleQuickReply(reply) {
  addMessage(reply, 'user');
  getSmartResponse(reply);
  document.querySelectorAll('.quick-reply-btn').forEach(btn => btn.style.display = 'none');
}

function botReply(text, delay = Math.random() * 400 + 300, typing = true) {
  setTimeout(() => {
    addMessage(text, 'bot', typing);
  }, delay);
}

function resetBooking() {
  bookingState = null;
  bookingData = {};
}

function validatePhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

function validateDate(dateStr) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) {
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dateObj >= today;
  }
  
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return date instanceof Date && !isNaN(date) && date >= today;
}

function validateTime(timeStr) {
  const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i;
  return timeRegex.test(timeStr.trim());
}

function sendToWhatsApp() {
  const message = `*New Appointment Request*\n\n` +
    `👤 *Name:* ${bookingData.name}\n` +
    `📞 *Phone:* ${bookingData.phone}\n` +
    `📅 *Date:* ${bookingData.date}\n` +
    `🕐 *Time:* ${bookingData.time}\n` +
    `🦷 *Service:* ${bookingData.service}\n` +
    `💬 *Concern:* ${bookingData.concern}\n\n` +
    `*Requested via Website Chatbot*`;
  
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${clinicInfo.contact.whatsapp}?text=${encodedMessage}`;
  
  window.open(whatsappUrl, '_blank');
}

function handleBookingFlow(input) {
  const trimmedInput = input.trim();
  
  if (!bookingState) {
    bookingState = 'name';
    botReply("I'd be happy to help you book an appointment! 😊<br><br>First, let's get your name. What should I call you?");
    return;
  }
  
  switch (bookingState) {
    case 'name':
      if (trimmedInput.length < 2) {
        botReply("Please enter a valid name (at least 2 characters).");
        return;
      }
      bookingData.name = trimmedInput;
      userContext.name = trimmedInput;
      bookingState = 'phone';
      botReply(`Nice to meet you, ${bookingData.name}! 👋<br><br>Could you share your phone number? (Include country code if outside India)`);
      break;
      
    case 'phone':
      if (!validatePhone(trimmedInput)) {
        botReply("Please enter a valid phone number (10-15 digits).<br>Example: 9876543210 or +91 9876543210");
        return;
      }
      bookingData.phone = trimmedInput;
      bookingState = 'date';
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      botReply(`Perfect! Which date would you prefer?<br><br>📅 Please enter in YYYY-MM-DD format<br>Example: ${tomorrow}<br><br>Or you can type dates like "tomorrow", "next Monday", etc.`);
      break;
      
    case 'date':
      let parsedDate = trimmedInput;
      
      if (trimmedInput.toLowerCase().includes('tomorrow')) {
        parsedDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      } else if (trimmedInput.toLowerCase().includes('today')) {
        parsedDate = new Date().toISOString().split('T')[0];
      }
      
      if (!validateDate(parsedDate)) {
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        botReply(`Please enter a valid future date.<br>Format: YYYY-MM-DD<br>Example: ${tomorrow}`);
        return;
      }
      bookingData.date = parsedDate;
      bookingState = 'time';
      botReply(`Great choice! What time works best?<br><br>🕐 <strong>Available Slots:</strong><br>• Morning: 10:00 AM - 1:00 PM<br>• Evening: 5:00 PM - 9:00 PM<br><br>Please select or type your preferred time:`);
      break;
      
    case 'time':
      if (!validateTime(trimmedInput)) {
        botReply("Please enter time in format: '10:30 AM' or '6:00 PM'");
        return;
      }
      bookingData.time = trimmedInput;
      bookingState = 'service';
      botReply(`Excellent! What type of dental service do you need?<br><br>🦷 <strong>Popular Services:</strong><br>• General Checkup & Cleaning<br>• Root Canal Treatment<br>• Dental Implants<br>• Cosmetic Dentistry<br>• Orthodontics (Braces)<br>• Emergency Care<br><br>You can select from above or describe your needs:`);
      break;
      
    case 'service':
      bookingData.service = trimmedInput;
      bookingState = 'concern';
      botReply(`Almost done! Could you briefly describe your main concern or what brought you to seek dental care?<br><br>💭 <strong>For example:</strong><br>• "Tooth pain on left side"<br>• "Routine cleaning and checkup"<br>• "Want to improve my smile"<br>• "Emergency - broken tooth"`);
      break;
      
    case 'concern':
      bookingData.concern = trimmedInput;
      bookingState = 'confirm';
      const dateObj = new Date(bookingData.date);
      const formattedDate = dateObj.toLocaleDateString('en-IN', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      botReply(`Please review your appointment details:<br><br>📋 <strong>Appointment Summary</strong><br>👤 <strong>Name:</strong> ${bookingData.name}<br>📞 <strong>Phone:</strong> ${bookingData.phone}<br>📅 <strong>Date:</strong> ${formattedDate}<br>🕐 <strong>Time:</strong> ${bookingData.time}<br>🦷 <strong>Service:</strong> ${bookingData.service}<br>💬 <strong>Concern:</strong> ${bookingData.concern}<br><br>✅ Type 'confirm' to send request to WhatsApp<br>❌ Type 'cancel' to start over`);
      break;
      
    case 'confirm':
      if (patterns.yes.test(trimmedInput) || trimmedInput.toLowerCase().includes('confirm')) {
        botReply(`🎉 Perfect! Sending your appointment request...<br><br>📱 You'll be redirected to WhatsApp to complete your booking with our team.`);
        setTimeout(() => {
          sendToWhatsApp();
          botReply(`✅ Request sent successfully!<br><br>Our team will confirm your appointment within 2 hours at ${bookingData.phone}.<br><br>📍 <strong>${clinicInfo.name}</strong><br>📞 ${clinicInfo.contact.phones[0]}<br><br>Is there anything else I can help you with? 😊`);
          resetBooking();
        }, 1000);
      } else if (patterns.no.test(trimmedInput) || trimmedInput.toLowerCase().includes('cancel')) {
        botReply("No worries! Your booking has been cancelled.<br><br>Feel free to start a new appointment request anytime by saying 'book appointment'. 😊");
        resetBooking();
      } else {
        botReply("Please type 'confirm' to proceed with WhatsApp booking or 'cancel' to start over.");
      }
      break;
  }
}

function createLocationMessage() {
  return `📍 <strong>Our Location</strong><br><br>${clinicInfo.mapEmbed}<br><br>📍 <strong>${clinicInfo.name}</strong><br>📞 ${clinicInfo.contact.phones[0]}<br><br><div style="margin-top: 10px;"><button onclick="openDirections()" style="background: #25D366; color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-weight: bold;">🗺️ Get Directions</button></div>`;
}

function openDirections() {
  window.open('https://www.google.com/maps/dir//Rain+Dental+Aesthetic+and+Implant+Centre+%7C+Dr.+Anjali+Jha/@19.125380099999997,72.86784709999999,15z', '_blank');
}

function generatePersonalizedResponse(input, context) {
  const responses = {
    services: [
      `Based on your interest, ${context.name || 'there'}, here are our specialized treatments that might help you achieve the perfect smile! 😊`,
      `I'd love to tell you about our comprehensive dental services! Dr. Anjali Jha offers cutting-edge treatments with a gentle touch.`
    ],
    pain: [
      `I understand dental pain can be really uncomfortable! 😟 Dr. Anjali Jha specializes in emergency care and pain management.`,
      `Dental emergencies need immediate attention! Our clinic prioritizes urgent cases for quick relief.`
    ],
    cost: [
      `We believe in transparent pricing! Our consultation will give you a detailed treatment plan with clear costs - no hidden surprises! 💰`,
      `Investment in your dental health pays lifelong dividends! We offer flexible payment options and accept most insurance plans.`
    ]
  };
  
  for (let [key, responseArray] of Object.entries(responses)) {
    if (patterns[key].test(input)) {
      return responseArray[Math.floor(Math.random() * responseArray.length)];
    }
  }
  
  return null;
}

function getSmartResponse(input) {
  const msg = input.trim().toLowerCase();
  userContext.conversationCount++;
  userContext.previousQuestions.push(msg);
  
  if (userContext.previousQuestions.length > 10) {
    userContext.previousQuestions.shift();
  }
  
  if (bookingState) {
    handleBookingFlow(input);
    return;
  }
  
  if (patterns.greeting.test(msg)) {
    const personalGreeting = userContext.name ? `, ${userContext.name}` : '';
    const greetings = [
      `Hello${personalGreeting}! Welcome to ${clinicInfo.name}! 😊<br><br>I'm your AI dental assistant, ready to help with appointments, service info, and any questions about your oral health journey!`,
      `Hi there${personalGreeting}! 👋 Dr. Anjali Jha and our team are excited to help you achieve your perfect smile!<br><br>How can I assist you today?`,
      `Welcome${personalGreeting}! 🦷✨ Whether you need emergency care or a routine checkup, I'm here to guide you through our services!`
    ];
    botReply(greetings[Math.floor(Math.random() * greetings.length)]);
    userContext.currentTopic = 'greeting';
    return;
  }
  
  if (patterns.booking.test(msg)) {
    handleBookingFlow('');
    userContext.currentTopic = 'booking';
    return;
  }
  
  if (patterns.location.test(msg)) {
    botReply(createLocationMessage());
    userContext.currentTopic = 'location';
    return;
  }
  
  if (patterns.services.test(msg)) {
    const personalizedIntro = generatePersonalizedResponse(msg, userContext);
    botReply(`${personalizedIntro || 'We offer comprehensive dental care!'}<br><br>🦷 <strong>Our Specialties:</strong><br>• ${clinicInfo.services.slice(0, 8).join('<br>• ')}<br>• ${clinicInfo.services.slice(8).join('<br>• ')}<br><br>💫 <strong>Why Choose Us?</strong><br>• Latest technology & techniques<br>• Pain-free procedures<br>• Personalized treatment plans<br>• Emergency care available<br><br>Which service interests you most? 😊`);
    userContext.currentTopic = 'services';
    return;
  }
  
  if (patterns.pain.test(msg)) {
    const urgentResponse = generatePersonalizedResponse(msg, userContext);
    botReply(`${urgentResponse}<br><br>🚨 <strong>Immediate Actions:</strong><br>• Call us now: ${clinicInfo.contact.phones[0]}<br>• WhatsApp: ${clinicInfo.contact.whatsapp}<br>• We accommodate same-day emergencies<br><br>💊 <strong>Temporary Relief:</strong><br>• Rinse with warm salt water<br>• Cold compress for swelling<br>• Over-the-counter pain relief<br>• Avoid hot/cold foods<br><br>🚑 <strong>Need urgent appointment?</strong> I can help you book immediately!`);
    userContext.currentTopic = 'emergency';
    return;
  }
  
  if (patterns.cost.test(msg)) {
    const costResponse = generatePersonalizedResponse(msg, userContext);
    botReply(`${costResponse}<br><br>💰 <strong>Transparent Pricing:</strong><br>• Consultation: Affordable initial assessment<br>• Treatment plans: Detailed cost breakdown<br>• Payment options: Flexible installments<br>• Insurance: Most plans accepted<br><br>📋 <strong>Cost Factors:</strong><br>• Complexity of treatment<br>• Materials used<br>• Number of sessions<br>• Insurance coverage<br><br>For accurate pricing, book a consultation where Dr. Jha will assess your needs! 📞`);
    userContext.currentTopic = 'cost';
    return;
  }
  
  if (patterns.hours.test(msg)) {
    botReply(`⏰ <strong>Clinic Hours</strong><br><br>📅 ${clinicInfo.hours.weekdays}<br>📅 ${clinicInfo.hours.sunday}<br><br>💡 <strong>Pro Tips:</strong><br>• Morning slots: Less crowded<br>• Evening slots: Perfect for working professionals<br>• Weekend appointments: Available on Saturdays<br>• Emergency care: Call anytime!<br><br>Ready to schedule your visit? 📱`);
    userContext.currentTopic = 'hours';
    return;
  }
  
  if (patterns.contact.test(msg)) {
    botReply(`📞 <strong>Get In Touch</strong><br><br>☎️ <strong>Phone Numbers:</strong><br>• Primary: ${clinicInfo.contact.phones[0]}<br>• Secondary: ${clinicInfo.contact.phones[1]}<br><br>📱 <strong>WhatsApp:</strong> ${clinicInfo.contact.whatsapp}<br>📍 <strong>Location:</strong> ${clinicInfo.contact.location}<br><br>🕐 <strong>Response Times:</strong><br>• Phone calls: Immediate during clinic hours<br>• WhatsApp: Within 30 minutes<br>• Emergencies: 24/7 support<br><br>💬 Or continue chatting here - I can help book appointments instantly! 😊`);
    userContext.currentTopic = 'contact';
    return;
  }
  
  if (patterns.doctor.test(msg)) {
    botReply(`👩‍⚕️ <strong>Meet ${clinicInfo.doctor.name}</strong><br><br>🎓 <strong>Qualifications:</strong> ${clinicInfo.doctor.qualifications}<br>🦷 <strong>Specialization:</strong> ${clinicInfo.doctor.specialization}<br><br>🌟 <strong>Expertise:</strong><br>• 10+ years of clinical experience<br>• Advanced implant procedures<br>• Cosmetic smile transformations<br>• Pain-free treatment techniques<br>• Latest technology adoption<br><br>💭 <strong>Patient Reviews:</strong><br>"Gentle, professional, and highly skilled!"<br>"Transformed my smile beautifully!"<br>"Emergency care was exceptional!"<br><br>Ready to experience expert dental care? 📅`);
    userContext.currentTopic = 'doctor';
    return;
  }
  
  if (patterns.help.test(msg)) {
    botReply(`🤖 <strong>I'm here to help!</strong><br><br>💬 <strong>What I can do:</strong><br>• Book appointments instantly<br>• Answer service questions<br>• Provide clinic information<br>• Show location & directions<br>• Handle emergency queries<br>• Connect you with our team<br><br>🗣️ <strong>Try saying:</strong><br>• "Book appointment"<br>• "Show location"<br>• "What services do you offer?"<br>• "I have tooth pain"<br>• "Contact information"<br><br>What would you like to explore? 😊`);
    return;
  }
  
  if (patterns.thanks.test(msg)) {
    const thankResponses = [
      `You're absolutely welcome! 😊 Your oral health is our priority. Feel free to ask anything else!`,
      `My pleasure! 🦷 Remember, I'm here 24/7 for any dental questions or appointment bookings!`,
      `Happy to help! ✨ Dr. Anjali Jha and our team look forward to serving you soon!`
    ];
    botReply(thankResponses[Math.floor(Math.random() * thankResponses.length)]);
    return;
  }
  
  if (patterns.goodbye.test(msg)) {
    const name = userContext.name ? `, ${userContext.name}` : '';
    botReply(`Take care${name}! 👋 Thank you for choosing ${clinicInfo.name}.<br><br>💫 <strong>Remember:</strong><br>• I'm available 24/7 for questions<br>• Emergency support: ${clinicInfo.contact.phones[0]}<br>• Quick bookings anytime!<br><br>Wishing you a healthy, beautiful smile! 😊🦷✨`);
    return;
  }
  
  if (userContext.currentTopic === 'services') {
    const serviceKeywords = {
      'root canal': `🦷 <strong>Root Canal Excellence</strong><br><br>Dr. Anjali Jha uses advanced rotary endodontics for:<br>• Single-visit procedures when possible<br>• Microscopic precision<br>• Virtually painless treatment<br>• High success rates (95%+)<br><br>💡 Modern root canals are comfortable and save your natural teeth! Ready to book? 📱`,
      'implant': `🔧 <strong>Dental Implants</strong><br><br>Transform your smile with our implant expertise:<br>• Titanium implants for permanence<br>• Same-day procedures available<br>• Computer-guided placement<br>• Natural-looking results<br><br>💪 Regain confidence with permanent tooth replacement! Interested in consultation? 📅`,
      'whitening': `✨ <strong>Teeth Whitening</strong><br><br>Brighten your smile safely:<br>• Professional-grade whitening<br>• Immediate results<br>• Customized treatment intensity<br>• Long-lasting effects<br><br>🌟 Achieve 3-8 shades whiter in one session! Book your transformation! 📞`
    };
    
    for (let [keyword, response] of Object.entries(serviceKeywords)) {
      if (msg.includes(keyword)) {
        botReply(response);
        return;
      }
    }
  }
  
  const contextualResponses = [
    `I understand you're looking for specific information! 🤔<br><br>🎯 <strong>I can help with:</strong><br>• Appointment booking ("book appointment")<br>• Service details ("what services?")<br>• Location & directions ("where are you?")<br>• Doctor information ("tell me about doctor")<br>• Emergency care ("tooth pain")<br>• Clinic hours ("what are your hours?")<br><br>What specific information would you like? 😊`,
    
    `Let me guide you to the right information! 🗺️<br><br>🔍 <strong>Popular queries:</strong><br>• "Book appointment" - Instant booking<br>• "Show location" - Map & directions<br>• "Emergency" - Urgent care info<br>• "Services" - Treatment options<br>• "Cost" - Pricing information<br><br>Just type what you need or select from above! 💬`,
    
    `I'm here to make your dental journey smooth! 🦷<br><br>💡 <strong>Quick actions:</strong><br>• Need appointment? Say "book now"<br>• In pain? Type "emergency"<br>• Want directions? Ask "location"<br>• Service info? Try "treatments"<br><br>How can I assist you today? 🌟`
  ];
  
  const response = contextualResponses[Math.floor(Math.random() * contextualResponses.length)];
  botReply(response);
}

chatbotForm.addEventListener('submit', function(e) {
  e.preventDefault();
  const input = chatbotInput.value.trim();
  if (!input) return;
  
  addMessage(input, 'user');
  chatbotInput.value = '';
  getSmartResponse(input);
});

window.addEventListener('click', function(e) {
  if (
    chatbotWindow.classList.contains('active') &&
    !chatbotWindow.contains(e.target) &&
    e.target !== chatbotBubble &&
    !chatbotBubble.contains(e.target)
  ) {
    hideChatbot();
  }
});


// Enhanced greeting function
function greetOnOpen() {
  if (chatbotMessages.childElementCount > 0) return;
  
  const welcomeMessages = [
    `Hello! Welcome to ${clinicInfo.name}! 😊<br><br>I'm your dental assistant, ready to help you with:<br>• Booking appointments<br>• Service information<br>• Clinic details<br><br>How can I help you today?`,
    
    `Hi there! 👋 I'm here to make your dental care experience smooth and easy.<br><br>Whether you need to book an appointment or have questions about our services, just let me know!<br><br>What brings you to ${clinicInfo.name} today?`
  ];
  
  const message = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
  setTimeout(() => {
    addMessage(message, 'bot', true);
  }, 500);
}

// Enhanced observer for better initialization
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
      if (chatbotWindow.classList.contains('active') && chatbotMessages.childElementCount === 0) {
        greetOnOpen();
      }
    }
  });
});

observer.observe(chatbotWindow, { 
  attributes: true, 
  attributeFilter: ['class'] 
});

// Auto-focus on input when chatbot opens
chatbotWindow.addEventListener('transitionend', () => {
  if (chatbotWindow.classList.contains('active')) {
    chatbotInput.focus();
  }
});

// Add some CSS for typing indicator (add to your CSS file)
const style = document.createElement('style');
style.textContent = `
  .typing-indicator {
    font-size: 1.2em;
    animation: typing 1.4s infinite;
  }
  
  @keyframes typing {
    0%, 60%, 100% { opacity: 1; }
    30% { opacity: 0.4; }
  }
`;
document.head.appendChild(style);