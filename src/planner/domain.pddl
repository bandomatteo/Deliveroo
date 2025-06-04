(define (domain deliveroo)
  (:requirements :strips :typing)
  (:types agent parcel cell)

  (:predicates
    (at ?a - agent ?c - cell)
    (parcel-at ?p - parcel ?c - cell)
    (carrying ?a - agent ?p - parcel)
    (base ?c - cell)
    (adjacent ?c1 ?c2 - cell)
    (delivered ?p - parcel))

  (:action move
    :parameters (?a - agent ?from - cell ?to - cell)
    :precondition (and (at ?a ?from) (adjacent ?from ?to))
    :effect (and (not (at ?a ?from)) (at ?a ?to)))

  (:action pickup
    :parameters (?a - agent ?p - parcel ?c - cell)
    :precondition (and (at ?a ?c) (parcel-at ?p ?c))
    :effect (and (not (parcel-at ?p ?c)) (carrying ?a ?p)))

  (:action drop
    :parameters (?a - agent ?p - parcel ?c - cell)
    :precondition (and (at ?a ?c) (base ?c) (carrying ?a ?p))
    :effect (and (not (carrying ?a ?p)) (delivered ?p)))
)