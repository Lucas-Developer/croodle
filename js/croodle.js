// app initialization
Ember.MODEL_FACTORY_INJECTIONS = true;

window.App = Ember.Application.create({
    LOG_TRANSITIONS: true,
    
    ready: function(){
        this.register('encryption:current', App.Encryption, {singleton: true});
        this.inject('controller:poll', 'encryption', 'encryption:current');
        this.inject('route:create', 'encryption', 'encryption:current');
        this.inject('model', 'encryption', 'encryption:current');
    }
});

// adapter initialization
App.ApplicationAdapter = DS.EmbeddedAdapter.extend({
    // set namespace to api.php in same subdirectory
    namespace: 'api.php?'
});

// serializer initialization
App.ApplicationSerializer = DS.EmbeddedSerializer.extend();

// adding support for attribut data-option-id to input fields
Ember.TextField.reopen({
    attributeBindings: ['data-option']
});

// decrypt / encrypt computed property helper
Ember.computed.encrypted = function(encryptedField) {
    return Ember.computed(encryptedField, function(key, decryptedValue) {
        var encryptKey = this.get('encryption.key'),
            encryptedValue;

        // check if encryptKey is set
        if (typeof encryptKey === 'undefined') {
            console.log("encryption key is not set for: " + this.toString() + " " + encryptedField);
            return;
        }

        // setter
        if (arguments.length === 2) {
            encryptedValue = Ember.isNone(decryptedValue) ? null : String( sjcl.encrypt( encryptKey , decryptedValue) );
            this.set(encryptedField, encryptedValue);
        }
        
        // get value of field to decrypt
        encryptedValue = this.get(encryptedField);
        
        // check if encryptedField is defined and not null
        if (typeof encryptedValue === 'undefined' ||
                encryptedValue === null) {
            return null;
        }

        // try to decrypt value
        try {
            decryptedValue = sjcl.decrypt( encryptKey , encryptedValue);
        } catch (e) {
            console.log('Error on decrypting ' + encryptedField);
            console.log('Value to decrypt:');
            console.log(encryptedValue);
            console.log('Error message by SJCL:');
            console.log(e);
            console.log('Perhaps a wrong encryption key?');
            decryptedValue = '';
        }
        return Ember.isNone(encryptedValue) ? null : String( decryptedValue );
    });
};

/*
 * models
 */

// poll model
App.Poll = DS.Model.extend({
    encryptedTitle : DS.attr('string'),
    title : Ember.computed.encrypted('encryptedTitle'),
    encryptedDescription : DS.attr('string'),
    description: Ember.computed.encrypted('encryptedDescription'),
    encryptedType : DS.attr('string'),
    type : Ember.computed.encrypted('encryptedType'),
    options : DS.hasMany('option', {async: true}),
    users : DS.hasMany('user', {async: true}),
    creationDate : DS.attr('date')
});

// option model
// used by poll model
App.Option = DS.Model.extend({
    encryptedTitle : DS.attr('string'),
    title : Ember.computed.encrypted('encryptedTitle')
});

// user model
// used by poll model
App.User = DS.Model.extend({
    poll : DS.belongsTo('poll', {async: true}),
    encryptedName : DS.attr('string'),
    name : Ember.computed.encrypted('encryptedName'),
    selections : DS.hasMany('selection', {async: true}),
    creationDate : DS.attr('date')
});

// selection model
// used by user model
App.Selection = DS.Model.extend({
    encryptedValue : DS.attr('string'),
    value : Ember.computed.encrypted('encryptedValue')
});

App.Encryption = Ember.Object.extend({
    key : '',
    isSet: false
});

App.Types = [
   Ember.Object.create({
        id : "FindADate",
        label : "Find a date"
   }),
   Ember.Object.create({
        id : "MakeAPoll",
        label : "Make a poll"
   })
];

/*
 * Serializer
 */
App.PollSerializer = App.ApplicationSerializer.extend({
    attrs: {
        options: {embedded: 'always'},
        users: {embedded: 'load'}
    }
});

App.UserSerializer = App.ApplicationSerializer.extend({
    attrs: {
        selections: {embedded: 'always'}
    }
});

/*
 * routes
 */

// defining routes of app
App.Router.map(function(){
     this.route('poll', { path: '/poll/:poll_id' });
     this.resource('create', function(){
         this.route('meta');
         this.route('options');
         this.route('settings');
     });
});

App.CreateRoute = Ember.Route.extend({
    beforeModel: function(){
        // generate encryptionKey
        var encryptionKeyLength = 40;
        var encryptionKeyChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

        var encryptionKey = '';
        var list = encryptionKeyChars.split('');
        var len = list.length, i = 0;
        do {
            i++;
            var index = Math.floor(Math.random() * len);
            encryptionKey += list[index];
        } while(i < encryptionKeyLength);

        // set encryption key
        this.set('encryption.key', encryptionKey);
    },
    
    model: function(){
        // create empty poll
        return this.store.createRecord('poll', {
            creationDate : new Date()
        });
    }
});

App.CreateIndexRoute = Ember.Route.extend({
    model: function(){
        return this.modelFor('create');
    }
});

App.CreateMetaRoute = Ember.Route.extend({
    model: function(){
        return this.modelFor('create');
    },

    // redirect to create/index if type is not set
    afterModel: function(create){
        if (create.get('type') === null) {
            this.transitionTo('create.index');
        }
    }
});

App.CreateOptionsRoute = Ember.Route.extend({
    model: function(){
        return this.modelFor('create');
    },

    // redirect to create/meta if title is not set
    afterModel: function(create){
        if (create.get('title') === null) {
            this.transitionTo('create.meta');
        }
    }
});

App.CreateSettingsRoute = Ember.Route.extend({
    model: function(){
        return this.modelFor('create');
    },

    // redirect to create/options if less then two options are defined
    afterModel: function(create){
        if (create.get('options.length') < 2) {
            this.transitionTo('create.options');
        }
    }
});

App.PollRoute = Ember.Route.extend({
    model: function(params){
        return this.store.find('poll', params.poll_id).then(function(poll) {
            return poll;
        });
    }
});

/*
 * controller
 */
App.CreateIndexController = Ember.ObjectController.extend({
   actions: {
       save: function(){
           // redirect to CreateMeta
           this.transitionToRoute('create.meta');
       }
   }
});

App.CreateMetaController = Ember.ObjectController.extend({
   actions: {
       save: function(){
           // redirect to CreateOptions
           this.transitionToRoute('create.options');
       }
   }
});

App.CreateOptionsController = Ember.ObjectController.extend({
    actions: {           
        addOptions: function(options) {
            var self = this;
            
            // delete old options in model
            this.get('model.options').clear();
            
            // iterate over array of options and push them to poll
            options.forEach(function(option){
                // check if option has title and if it is unique
                if( /\S/.test(option.title)) {
                    // create newOption
                    var newOption = self.store.createRecord('option', {
                        title : option.title
                    });

                    // assign it to poll
                    self.get('model.options').then(function(model){
                        model.pushObject(newOption);
                    });
                }
            });

            this.send('save');
        },

        save: function(){
            // redirect to CreateSettings
            this.transitionToRoute('create.settings');
        }
    }
});

App.CreateSettingsController = Ember.ObjectController.extend({
    actions: {
        save: function(){
            // save poll
            var self = this;
            this.get('model').save().then(function(model){
                // reload as workaround for bug: duplicated records after save
                model.reload().then(function(model){
                   // redirect to new poll
                   self.transitionToRoute('poll', model, {queryParams: {encryptionKey: self.get('encryption.key')}}); 
                });
            });
        }
    }
});

App.PollController = Ember.ObjectController.extend({
    queryParams: ['encryptionKey'],
    encryptionKey: '',

    actions: {
        saveNewUser: function(user){
            var self = this;
            
            // create new user record in store
            var newUser = this.store.createRecord('user', {
                name: user.name,
                creationDate: new Date(),
                poll: this.get('model')
            });

            // create new selection record in store and assign it to the new user
            var newSelections = [];
            user.selections.forEach(function(selection){
                // create new selection record in store
                var newSelection = self.store.createRecord('selection', {
                    value: selection.value
                });
               
                // store new selections in an array
                newSelections.push(newSelection);
            });
            
            newUser.get('selections').then(function(selections){
                // map over all new selections and assign them to user
                $.each(newSelections, function(){
                    selections.pushObject(this);
                });

                // save new user
                newUser.save().then(function(){
                    self.get('model.users').then(function(users){
                        // assign new user to poll
                        users.pushObject(newUser);
                    });
                    // reload as workaround for bug: duplicated records after save
                    self.get('model').reload();
                });
            });
        }
    },
    
    updateEncryptionKey: function() {
        // update encryption key
        this.set('encryption.key', this.get('encryptionKey'));
        
        // reload content to recalculate computed properties
        // if encryption key was set before
        if (this.get('encryption.isSet') === true) {
            this.get('content').reload();
        }
        
        this.set('encryption.isSet', true);
    }.observes('encryptionKey')
});

/*
 * views
 */
App.CreateOptionsView = Ember.View.extend({
    title: '',
    newOptions: [],
    
    actions: {
        moreOptions: function(){
            // create new Option
            this.get('newOptions').pushObject({title: ''});
       },
       
       saveOptions: function(){
            var options = this.get('newOptions');
            
            this.get('controller').send('addOptions', options);
       }
    },
    
    // set newOptions to existing options or to default
    willInsertElement: function() {
        var newOptions = Ember.A();
        
        if ( this.get('controller.model.options.length') > 0 ) {
            // existing options
            this.get('controller.model.options').forEach(function(option){
                newOptions.pushObject({title: option.get('title')});
            });
        }
        else {
            // default
            for(i = 0; i < 2; i++) {
                newOptions.pushObject({title: ''});
            }
        }
        this.set('newOptions', newOptions);
    }
});

App.PollView = Ember.View.extend({
    newUserName: '',
    newUserSelections: [],
            
    actions: {
        addNewUser: function(){
            var newUser = {
                name: this.get('newUserName'),
                selections: this.get('newUserSelections')
            };
            
            this.get('controller').send('saveNewUser', newUser);
            
            // clear input fields
            this.set('newUserName', '');
            this.get('newUserSelections').forEach(function(selection){
                selection.set('value', '');
            });
        }
    },
    
    // generate selection array for new user
    willInsertElement: function(){
        var newUserSelections = Ember.A(),
            self = this;
        this.get('controller.model.options').then(function(options){
            options.forEach(function(){
                newSelection = Ember.Object.create({value: ''});
                newUserSelections.pushObject(newSelection);
            });
            self.set('newUserSelections', newUserSelections);
        });
    }
});